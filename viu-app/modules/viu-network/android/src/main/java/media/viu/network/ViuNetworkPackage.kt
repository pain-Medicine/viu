package media.viu.network

import android.app.Application
import android.content.Context
import expo.modules.core.interfaces.ApplicationLifecycleListener
import expo.modules.core.interfaces.Package

// Installs the proxy selector in Application.onCreate, before React Native
// builds its HTTP client, so every client in the app picks it up.
class ViuNetworkPackage : Package {
  override fun createApplicationLifecycleListeners(context: Context): List<ApplicationLifecycleListener> =
    listOf(object : ApplicationLifecycleListener {
      override fun onCreate(application: Application) {
        ViuProxySelector.install()
      }
    })
}
