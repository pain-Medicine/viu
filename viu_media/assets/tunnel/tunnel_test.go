package viutunnel

import (
	"strings"
	"testing"
)

// The config is parsed from memory, so a tunnel comes up without writing a
// temp file. The peer doesn't need to exist for the device to start.
func TestStartFromConfigText(t *testing.T) {
	conf := `[Interface]
PrivateKey = yAnz5TF+lXXJte14tji3zlMNq+hd2rYUIgJBgB3fBmk=
Address = 10.2.0.2/32
DNS = 10.2.0.1

[Peer]
PublicKey = xTIBA5rboUvnH4htodjb6e697QjLERt1NAB4mZqp8Dg=
AllowedIPs = 0.0.0.0/0
Endpoint = 127.0.0.1:51820
`
	addr, err := Start(conf, "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	defer Stop()
	if !strings.HasPrefix(addr, "127.0.0.1:") {
		t.Fatalf("unexpected proxy address %q", addr)
	}
}

func TestStartRejectsBadConfig(t *testing.T) {
	if _, err := Start("[Interface]\nPrivateKey = nope\n", "127.0.0.1:0"); err == nil {
		Stop()
		t.Fatal("expected an error for a config without a valid key")
	}
}
