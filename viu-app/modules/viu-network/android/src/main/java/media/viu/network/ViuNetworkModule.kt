package media.viu.network

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import media.viu.viutunnel.Viutunnel

// Where traffic goes while no mode is in place: nothing listens there, so
// requests fail instead of leaving without the proxy or VPN.
private const val BLOCKED = "http://127.0.0.1:9"

class ViuNetworkModule : Module() {
  private var importServer: ConfigImportServer? = null

  override fun definition() = ModuleDefinition {
    Name("ViuNetwork")

    Events("onConfigReceived")

    // Sends all of the app's traffic (API calls, images, video) to this proxy; null turns it off.
    Function("setProxy") { url: String? ->
      ViuProxySelector.install()
      ViuProxySelector.set(url)
    }

    // Starts the WireGuard tunnel in-process and routes the app through it.
    // Returns the local proxy URL.
    AsyncFunction("startTunnel") { wgConfig: String ->
      ViuProxySelector.install()
      val proxy = "http://" + Viutunnel.start(wgConfig, "127.0.0.1:0")
      ViuProxySelector.set(proxy)
      proxy
    }

    // Leaves traffic blocked rather than direct: the caller sets the next mode
    // right after, and a VPN start can take seconds.
    Function("stopTunnel") {
      ViuProxySelector.set(BLOCKED)
      Viutunnel.stop()
    }

    // Serves a page on the home network where a phone can paste or upload a
    // WireGuard config. Returns the address to open, e.g. http://192.168.1.20:8735
    AsyncFunction("startImportServer") { port: Int ->
      importServer?.stop()
      val server = ConfigImportServer(port) { text -> sendEvent("onConfigReceived", mapOf("config" to text)) }
      importServer = server
      server.start()
    }

    Function("stopImportServer") {
      importServer?.stop()
      importServer = null
    }

    OnDestroy {
      importServer?.stop()
    }
  }
}
