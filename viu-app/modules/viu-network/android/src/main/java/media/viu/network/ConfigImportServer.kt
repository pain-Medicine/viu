package media.viu.network

import java.io.BufferedInputStream
import java.io.ByteArrayOutputStream
import java.net.Inet4Address
import java.net.NetworkInterface
import java.net.ServerSocket
import java.net.Socket
import java.net.URLDecoder
import java.security.SecureRandom
import kotlin.concurrent.thread

/**
 * A tiny one-page web server on the home network, so a WireGuard config can
 * come from a phone instead of being typed with a TV remote. It only accepts a
 * GET for the form and a POST with the config, and stops when the import
 * screen closes. The address carries a random secret (shown only in the QR
 * code), so others on the same network can't send a config of their own.
 */
class ConfigImportServer(private val port: Int, private val onConfig: (String) -> Unit) {
  @Volatile private var socket: ServerSocket? = null
  private val secret = ByteArray(16).also { SecureRandom().nextBytes(it) }.joinToString("") { "%02x".format(it) }

  /** Starts listening and returns the URL to open on the phone. */
  fun start(): String {
    val server = ServerSocket(port)
    socket = server
    thread(name = "viu-config-import", isDaemon = true) {
      while (!server.isClosed) {
        val client = try { server.accept() } catch (e: Exception) { break }
        // An uncaught exception here would kill the app, and idle or dropped
        // phone connections throw (read timeout, broken pipe).
        thread(isDaemon = true) {
          try {
            client.use { handle(it) }
          } catch (e: Exception) {
          }
        }
      }
    }
    return "http://${lanAddress()}:${server.localPort}/$secret"
  }

  fun stop() {
    socket?.close()
    socket = null
  }

  private fun handle(client: Socket) {
    client.soTimeout = 15_000
    val input = BufferedInputStream(client.getInputStream())
    val requestLine = readLine(input) ?: return
    var contentLength = 0
    while (true) {
      val header = readLine(input) ?: return
      if (header.isEmpty()) break
      if (header.startsWith("content-length:", ignoreCase = true)) {
        contentLength = header.substringAfter(':').trim().toIntOrNull() ?: 0
      }
    }
    val out = client.getOutputStream()
    val path = requestLine.split(' ').getOrNull(1)?.substringBefore('?')
    if (path != "/$secret") {
      respond(out, 404, page("Scan the code on the TV to open this page."))
      return
    }
    if (!requestLine.startsWith("POST ")) {
      respond(out, 200, FORM_PAGE)
      return
    }
    if (contentLength > MAX_CONFIG_BYTES) {
      respond(out, 413, page("That file is too big to be a WireGuard config."))
      return
    }
    val body = ByteArray(contentLength)
    var read = 0
    while (read < contentLength) {
      val n = input.read(body, read, contentLength - read)
      if (n < 0) break
      read += n
    }
    val form = String(body, 0, read, Charsets.UTF_8)
    val config = form.split('&')
      .firstOrNull { it.startsWith("config=") }
      ?.let { URLDecoder.decode(it.removePrefix("config="), "UTF-8") }
      .orEmpty()
      .trim()
    if (!config.contains("[Interface]", ignoreCase = true) || !config.contains("[Peer]", ignoreCase = true)) {
      respond(out, 400, page("That doesn't look like a WireGuard config. It needs an [Interface] and a [Peer] section."))
      return
    }
    onConfig(config)
    respond(out, 200, page("Sent. Your TV has the config now, you can close this page."))
  }

  private fun readLine(input: BufferedInputStream): String? {
    val line = ByteArrayOutputStream()
    while (true) {
      val b = input.read()
      if (b < 0) return if (line.size() == 0) null else line.toString("UTF-8")
      if (b == '\n'.code) return line.toString("UTF-8").trimEnd('\r')
      if (line.size() > 8192) return null
      line.write(b)
    }
  }

  private fun respond(out: java.io.OutputStream, status: Int, html: String) {
    val bytes = html.toByteArray(Charsets.UTF_8)
    val reason = mapOf(200 to "OK", 400 to "Bad Request", 404 to "Not Found", 413 to "Payload Too Large")[status] ?: "OK"
    out.write(
      "HTTP/1.1 $status $reason\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: ${bytes.size}\r\nConnection: close\r\n\r\n"
        .toByteArray(Charsets.US_ASCII),
    )
    out.write(bytes)
    out.flush()
  }

  companion object {
    private const val MAX_CONFIG_BYTES = 64 * 1024

    fun lanAddress(): String =
      NetworkInterface.getNetworkInterfaces().toList()
        .filter { it.isUp && !it.isLoopback }
        .flatMap { it.inetAddresses.toList() }
        .firstOrNull { it is Inet4Address && it.isSiteLocalAddress }
        ?.hostAddress ?: "127.0.0.1"

    private fun page(message: String) = """
      <!doctype html><meta name="viewport" content="width=device-width,initial-scale=1">
      <title>Viu</title><body style="font-family:system-ui;background:#1A1110;color:#F1DFDB;padding:24px">
      <h2>Viu</h2><p>$message</p></body>
    """.trimIndent()

    private val FORM_PAGE = """
      <!doctype html><meta name="viewport" content="width=device-width,initial-scale=1">
      <title>Send a WireGuard config to Viu</title>
      <body style="font-family:system-ui;background:#1A1110;color:#F1DFDB;padding:24px;max-width:640px">
      <h2>Send a WireGuard config to Viu</h2>
      <p>Pick the .conf file (for Proton VPN: account.protonvpn.com, Downloads, WireGuard configuration), or paste its text.</p>
      <form method="post" id="f">
        <input type="file" accept=".conf,text/plain" id="file"><br><br>
        <textarea name="config" id="config" rows="14" style="width:100%" placeholder="[Interface]&#10;PrivateKey = ...&#10;&#10;[Peer]&#10;..."></textarea><br><br>
        <button style="font-size:18px;padding:10px 20px">Send to TV</button>
      </form>
      <script>
        document.getElementById('file').onchange = e => e.target.files[0].text().then(t => document.getElementById('config').value = t);
      </script></body>
    """.trimIndent()
  }
}
