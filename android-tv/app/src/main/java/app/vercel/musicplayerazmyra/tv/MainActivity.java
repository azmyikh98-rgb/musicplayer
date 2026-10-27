package app.vercel.musicplayerazmyra.tv;

import android.app.Activity;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.view.KeyEvent;
import android.view.WindowManager;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

/**
 * Pembungkus WebView untuk Nada di Google TV / Android TV.
 * Membuka situs Nada dalam mode TV (?tv=1) dan meneruskan tombol remote ke halaman.
 */
public class MainActivity extends Activity {
    private static final String HOST = "musicplayerazmyra.vercel.app";
    private static final String START = "https://" + HOST + "/?tv=1";

    private WebView web;
    private long lastBack = 0;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

        web = new WebView(this);
        web.setBackgroundColor(Color.parseColor("#0E0E13"));
        web.setFocusable(true);
        web.setFocusableInTouchMode(true);
        setContentView(web);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setSupportZoom(false);
        s.setCacheMode(WebSettings.LOAD_DEFAULT);

        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                if (!request.isForMainFrame()) return false;
                Uri u = request.getUrl();
                if (HOST.equals(u.getHost())) return false;
                try {
                    startActivity(new Intent(Intent.ACTION_VIEW, u));
                } catch (Exception e) {
                    Toast.makeText(MainActivity.this, "Tidak ada aplikasi untuk membuka tautan ini", Toast.LENGTH_SHORT).show();
                }
                return true;
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (request.isForMainFrame()) showError();
            }
        });

        web.loadUrl(START);
        web.requestFocus();
    }

    private void showError() {
        String html = "<html><body style='margin:0;background:#0e0e13;color:#f2f2f7;font-family:sans-serif;"
                + "display:flex;align-items:center;justify-content:center;height:100vh;text-align:center'>"
                + "<div><h1 style='font-size:48px'>Tidak ada koneksi</h1>"
                + "<p style='font-size:28px;color:#9a9aaa'>Periksa internet TV, lalu coba lagi.</p>"
                + "<button autofocus onclick=\"location.href='" + START + "'\" "
                + "style='font-size:30px;padding:16px 40px;border:0;border-radius:40px;background:#ff4f6d;color:#fff'>Coba lagi</button>"
                + "</div></body></html>";
        web.loadDataWithBaseURL(null, html, "text/html", "utf-8", null);
    }

    /** Kirim peristiwa keyboard ke halaman agar ditangani JavaScript Nada. */
    private void sendKey(String key) {
        web.evaluateJavascript(
                "(document.activeElement||document.body).dispatchEvent(new KeyboardEvent('keydown',{key:'" + key + "',bubbles:true}))",
                null);
    }

    @Override
    public boolean onKeyDown(int keyCode, KeyEvent event) {
        switch (keyCode) {
            case KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE:
            case KeyEvent.KEYCODE_MEDIA_PLAY:
            case KeyEvent.KEYCODE_MEDIA_PAUSE:
                sendKey("MediaPlayPause");
                return true;
            case KeyEvent.KEYCODE_MEDIA_NEXT:
            case KeyEvent.KEYCODE_MEDIA_FAST_FORWARD:
                sendKey("MediaTrackNext");
                return true;
            case KeyEvent.KEYCODE_MEDIA_PREVIOUS:
            case KeyEvent.KEYCODE_MEDIA_REWIND:
                sendKey("MediaTrackPrevious");
                return true;
            case KeyEvent.KEYCODE_PROG_YELLOW:
                sendKey("f"); // suka
                return true;
            case KeyEvent.KEYCODE_PROG_BLUE:
                sendKey("m"); // menu lagu
                return true;
            case KeyEvent.KEYCODE_PROG_GREEN:
                sendKey("l"); // video / lirik
                return true;
            default:
                return super.onKeyDown(keyCode, event);
        }
    }

    @Override
    @SuppressWarnings("deprecation")
    public void onBackPressed() {
        // Jika ada menu/daftar yang bisa ditutup, biarkan halaman menanganinya. Jika tidak, tekan dua kali untuk keluar.
        String probe = "(function(){try{return !!((!document.getElementById('menu').hidden)"
                + "||(!document.getElementById('suggest').hidden)||state.view)}catch(e){return false}})()";
        web.evaluateJavascript(probe, value -> {
            if ("true".equals(value)) {
                sendKey("GoBack");
                return;
            }
            long now = System.currentTimeMillis();
            if (now - lastBack < 2000) {
                finish();
            } else {
                lastBack = now;
                sendKey("GoBack");
                Toast.makeText(this, "Tekan Kembali sekali lagi untuk keluar", Toast.LENGTH_SHORT).show();
            }
        });
    }

    @Override
    protected void onPause() {
        super.onPause();
        // Jangan hentikan WebView agar lagu tetap jalan sebentar saat layar redup.
    }

    @Override
    protected void onDestroy() {
        if (web != null) web.destroy();
        super.onDestroy();
    }
}
