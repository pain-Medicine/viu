//go:build tools

// Keeps gomobile's bind package in go.mod, which `gomobile bind` needs
// to build the Android library.
package viutunnel

import _ "golang.org/x/mobile/bind"
