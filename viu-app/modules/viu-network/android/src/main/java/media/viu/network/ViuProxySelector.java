package media.viu.network;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.net.Proxy;
import java.net.ProxySelector;
import java.net.SocketAddress;
import java.net.URI;
import java.util.Collections;
import java.util.List;

/**
 * The app-wide proxy switch. Installed as the JVM default selector at app start,
 * before any HTTP client exists: OkHttp clients (React Native fetch, expo-video,
 * expo-image) copy the default selector when they are built, so a selector
 * swapped in later would be missed by the clients built earlier. This one stays
 * installed and only its target changes.
 *
 * While a proxy is set, every request goes to it and nothing falls back to a
 * direct connection, so a dead tunnel blocks traffic instead of leaking it.
 */
public final class ViuProxySelector extends ProxySelector {
  private static final ViuProxySelector INSTANCE = new ViuProxySelector(ProxySelector.getDefault());

  private final ProxySelector fallback;
  private volatile Proxy proxy;

  private ViuProxySelector(ProxySelector fallback) {
    this.fallback = fallback;
  }

  public static void install() {
    if (ProxySelector.getDefault() != INSTANCE) {
      ProxySelector.setDefault(INSTANCE);
    }
  }

  /** Sets the proxy from a URL such as http://127.0.0.1:8080 or socks5://host:1080; null or "" clears it. */
  public static void set(String url) {
    if (url == null || url.isEmpty()) {
      INSTANCE.proxy = null;
      return;
    }
    URI uri = URI.create(url);
    String scheme = uri.getScheme() == null ? "" : uri.getScheme().toLowerCase();
    Proxy.Type type;
    if (scheme.equals("http")) {
      type = Proxy.Type.HTTP;
    } else if (scheme.startsWith("socks")) {
      type = Proxy.Type.SOCKS;
    } else {
      throw new IllegalArgumentException("Proxy must start with http:// or socks5://");
    }
    if (uri.getHost() == null || uri.getPort() <= 0) {
      throw new IllegalArgumentException("Proxy needs a host and a port, like http://192.168.1.10:8080");
    }
    // Unresolved, so the proxy looks up names and the device's DNS sees nothing
    INSTANCE.proxy = new Proxy(type, InetSocketAddress.createUnresolved(uri.getHost(), uri.getPort()));
  }

  @Override
  public List<Proxy> select(URI uri) {
    Proxy current = proxy;
    if (current != null && !isLocal(uri.getHost())) {
      return Collections.singletonList(current);
    }
    return fallback != null ? fallback.select(uri) : Collections.singletonList(Proxy.NO_PROXY);
  }

  @Override
  public void connectFailed(URI uri, SocketAddress address, IOException e) {
    if (proxy == null && fallback != null) {
      fallback.connectFailed(uri, address, e);
    }
  }

  private static boolean isLocal(String host) {
    return host == null || host.equals("localhost") || host.startsWith("127.") || host.equals("::1") || host.equals("[::1]");
  }
}
