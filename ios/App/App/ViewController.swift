import UIKit
import WebKit
import CoreLocation

class ViewController: UIViewController, WKUIDelegate, WKNavigationDelegate, CLLocationManagerDelegate {
    var webView: WKWebView!
    var locationManager: CLLocationManager!

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = UIColor(red: 0.07, green: 0.06, blue: 0.05, alpha: 1.0)

        // Khởi tạo GPS Location Manager
        locationManager = CLLocationManager()
        locationManager.delegate = self
        locationManager.requestWhenInUseAuthorization()

        // Cấu hình WKWebView chạy offline mượt mà tràn viền toàn màn hình
        let config = WKWebViewConfiguration()
        config.allowsInlineMediaPlayback = true
        config.mediaTypesRequiringUserActionForPlayback = []
        config.preferences.setValue(true, forKey: "allowFileAccessFromFileURLs")

        webView = WKWebView(frame: .zero, configuration: config)
        webView.translatesAutoresizingMaskIntoConstraints = false
        webView.uiDelegate = self
        webView.navigationDelegate = self
        webView.scrollView.bounces = false
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        webView.isOpaque = false
        webView.backgroundColor = UIColor(red: 0.07, green: 0.06, blue: 0.05, alpha: 1.0)

        view.addSubview(webView)

        // Kích hoạt tràn viền tuyệt đối 100% cạnh-sang-cạnh
        NSLayoutConstraint.activate([
            webView.topAnchor.constraint(equalTo: view.topAnchor),
            webView.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            webView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            webView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
        ])

        loadGameLocalWeb()
    }

    func loadGameLocalWeb() {
        if let wwwURL = Bundle.main.url(forResource: "www", withExtension: nil) {
            let indexURL = wwwURL.appendingPathComponent("index.html")
            webView.loadFileURL(indexURL, allowingReadAccessTo: wwwURL)
        } else {
            print("⚠️ Không tìm thấy thư mục www trong main bundle")
        }
    }

    override var prefersStatusBarHidden: Bool {
        return false
    }

    override var preferredStatusBarStyle: UIStatusBarStyle {
        return .lightContent
    }
}
