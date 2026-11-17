// Package docs serves the OpenAPI specification and Swagger UI.
package docs

import (
	_ "embed"
	"net/http"
)

//go:embed openapi.yaml
var spec []byte

// Swagger UI is loaded from a CDN with a pinned version.
const uiHTML = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Sagas API docs</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5.17.14/swagger-ui.css">
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5.17.14/swagger-ui-bundle.js" crossorigin></script>
  <script>
    window.ui = SwaggerUIBundle({
      url: "/api/openapi.yaml",
      dom_id: "#swagger-ui",
      deepLinking: true,
      // The session cookie is HttpOnly, so requests must carry same-origin credentials.
      requestInterceptor: (req) => { req.credentials = "same-origin"; return req; },
    });
  </script>
</body>
</html>
`

// Spec serves the raw OpenAPI document.
func Spec(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/yaml; charset=utf-8")
	w.Write(spec)
}

// UI serves the Swagger UI page.
func UI(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.Write([]byte(uiHTML))
}
