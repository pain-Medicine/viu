// Package viutunnel runs a WireGuard tunnel fully in userspace and exposes it
// as a local HTTP proxy, so only the app that uses the proxy goes through the
// VPN. No system VPN, TUN device or admin rights are needed.
//
// The desktop app runs it as the viu-tunnel helper binary (cmd/viu-tunnel);
// the Android TV app links it as a gomobile library.
package viutunnel

import (
	"bufio"
	"context"
	"io"
	"net"
	"net/http"
	"net/netip"
	"os"
	"strconv"
	"sync"
	"time"

	"github.com/windtf/wireproxy"
)

var (
	mu      sync.Mutex
	current *tunnel
)

type tunnel struct {
	vt *wireproxy.VirtualTun
	ln net.Listener
}

// Start brings up the tunnel described by wgConfig (the text of a standard
// WireGuard .conf, e.g. from Proton VPN) and serves an HTTP proxy on bind
// ("127.0.0.1:0" picks a free port). It returns the proxy's address.
// A running tunnel is stopped first.
func Start(wgConfig string, bind string) (string, error) {
	mu.Lock()
	defer mu.Unlock()
	stopLocked()

	vt, err := startWireGuard(wgConfig)
	if err != nil {
		return "", err
	}
	ln, err := net.Listen("tcp", bind)
	if err != nil {
		vt.Dev.Close()
		return "", err
	}
	t := &tunnel{vt: vt, ln: ln}
	go t.serve()
	current = t
	return ln.Addr().String(), nil
}

// Stop closes the proxy and the tunnel. It is safe to call when nothing runs.
func Stop() {
	mu.Lock()
	defer mu.Unlock()
	stopLocked()
}

func stopLocked() {
	if current == nil {
		return
	}
	current.ln.Close()
	current.vt.Dev.Close()
	current = nil
}

func startWireGuard(wgConfig string) (*wireproxy.VirtualTun, error) {
	// wireproxy parses configs from files only
	f, err := os.CreateTemp("", "viu-wg-*.conf")
	if err != nil {
		return nil, err
	}
	defer os.Remove(f.Name())
	_, err = f.WriteString(wgConfig)
	f.Close()
	if err != nil {
		return nil, err
	}
	conf, err := wireproxy.ParseConfig(f.Name())
	if err != nil {
		return nil, err
	}
	return wireproxy.StartWireguard(conf, 0)
}

// dial opens a TCP connection through the tunnel, resolving names the way the
// config asks (its DNS server inside the tunnel, or the system resolver).
func (t *tunnel) dial(ctx context.Context, address string) (net.Conn, error) {
	host, portStr, err := net.SplitHostPort(address)
	if err != nil {
		return nil, err
	}
	port, err := strconv.Atoi(portStr)
	if err != nil {
		return nil, err
	}
	ip, err := netip.ParseAddr(host)
	if err != nil {
		resolved, rerr := t.vt.ResolveAddrWithContext(ctx, host)
		if rerr != nil {
			return nil, rerr
		}
		ip = *resolved
	}
	return t.vt.Tnet.DialContext(ctx, "tcp", netip.AddrPortFrom(ip, uint16(port)).String())
}

func (t *tunnel) serve() {
	transport := &http.Transport{
		DialContext: func(ctx context.Context, _, addr string) (net.Conn, error) {
			return t.dial(ctx, addr)
		},
		Proxy: nil,
	}
	for {
		conn, err := t.ln.Accept()
		if err != nil {
			return
		}
		go t.handle(conn, transport)
	}
}

func (t *tunnel) handle(conn net.Conn, transport *http.Transport) {
	defer conn.Close()
	reader := bufio.NewReader(conn)
	for {
		req, err := http.ReadRequest(reader)
		if err != nil {
			return
		}
		if req.Method == http.MethodConnect {
			// HTTPS: blind TCP pipe to the target through the tunnel
			ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
			upstream, err := t.dial(ctx, req.Host)
			cancel()
			if err != nil {
				io.WriteString(conn, "HTTP/1.1 502 Bad Gateway\r\n\r\n")
				return
			}
			io.WriteString(conn, "HTTP/1.1 200 Connection Established\r\n\r\n")
			pipe(conn, reader, upstream)
			return
		}
		// Plain HTTP: forward the absolute-URI request
		req.RequestURI = ""
		req.Header.Del("Proxy-Connection")
		req.Header.Del("Proxy-Authorization")
		resp, err := transport.RoundTrip(req)
		if err != nil {
			io.WriteString(conn, "HTTP/1.1 502 Bad Gateway\r\nContent-Length: 0\r\n\r\n")
			return
		}
		err = resp.Write(conn)
		resp.Body.Close()
		if err != nil || req.Close || resp.Close {
			return
		}
	}
}

func pipe(client net.Conn, clientBuf *bufio.Reader, upstream net.Conn) {
	defer upstream.Close()
	done := make(chan struct{}, 2)
	go func() {
		io.Copy(upstream, clientBuf)
		if c, ok := upstream.(interface{ CloseWrite() error }); ok {
			c.CloseWrite()
		}
		done <- struct{}{}
	}()
	go func() {
		io.Copy(client, upstream)
		done <- struct{}{}
	}()
	<-done
}
