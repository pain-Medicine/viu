// viu-tunnel is the desktop helper used by `viu --vpn`: it starts the tunnel,
// prints "listening <addr>" and runs until its stdin closes (i.e. viu exits).
package main

import (
	"flag"
	"fmt"
	"io"
	"os"

	viutunnel "github.com/viu-media/viu/tunnel"
)

func main() {
	configPath := flag.String("config", "", "WireGuard .conf file")
	bind := flag.String("bind", "127.0.0.1:0", "address for the local HTTP proxy")
	flag.Parse()

	conf, err := os.ReadFile(*configPath)
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
	addr, err := viutunnel.Start(string(conf), *bind)
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
	fmt.Println("listening", addr)
	io.Copy(io.Discard, os.Stdin)
	viutunnel.Stop()
}
