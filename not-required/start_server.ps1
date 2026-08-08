$port = 8080
$publicPath = Join-Path $PSScriptRoot "public"
$rootPath = if (Test-Path $publicPath) { $publicPath } else { $PSScriptRoot }

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$port/")
$listener.Prefixes.Add("http://127.0.0.1:$port/")
try {
    $listener.Start()
} catch {
    Write-Host "Could not start listener: $_"
    exit 1
}

Write-Host "===================================================="
Write-Host "  Admission Management System Web Server"
Write-Host "  Running at: http://localhost:$port/"
Write-Host "  Serving static files from: $rootPath"
Write-Host "===================================================="

try {
    while ($listener.IsListening) {
        $context = $listener.GetContext()
        $request = $context.Request
        $response = $context.Response

        # Prevent browser caching for instant live updates
        $response.Headers.Add("Cache-Control", "no-cache, no-store, must-revalidate")
        $response.Headers.Add("Pragma", "no-cache")
        $response.Headers.Add("Expires", "0")

        $rawUrl = $request.Url.LocalPath
        if ($rawUrl -eq "/") { $rawUrl = "/login.html" }
        if ($rawUrl -eq "/login") { $rawUrl = "/login.html" }
        if ($rawUrl -eq "/register") { $rawUrl = "/register.html" }
        if ($rawUrl -eq "/superuser") { $rawUrl = "/superuser.html" }
        if ($rawUrl -eq "/dashboard") { $rawUrl = "/index.html" }
        
        $filePath = Join-Path $rootPath $rawUrl.TrimStart('/')
        
        if (-not (Test-Path $filePath -PathType Leaf)) {
            $filePath = Join-Path $PSScriptRoot $rawUrl.TrimStart('/')
        }
        if (-not (Test-Path $filePath -PathType Leaf)) {
            $filePath = Join-Path (Join-Path $PSScriptRoot "public") $rawUrl.TrimStart('/')
        }

        if (Test-Path $filePath -PathType Leaf) {
            $bytes = [System.IO.File]::ReadAllBytes($filePath)
            
            # Content Types
            if ($filePath.EndsWith(".html")) { $response.ContentType = "text/html; charset=utf-8" }
            elseif ($filePath.EndsWith(".js")) { $response.ContentType = "application/javascript; charset=utf-8" }
            elseif ($filePath.EndsWith(".css")) { $response.ContentType = "text/css; charset=utf-8" }
            elseif ($filePath.EndsWith(".png")) { $response.ContentType = "image/png" }
            elseif ($filePath.EndsWith(".jpg") -or $filePath.EndsWith(".jpeg")) { $response.ContentType = "image/jpeg" }
            elseif ($filePath.EndsWith(".pdf")) { $response.ContentType = "application/pdf" }
            elseif ($filePath.EndsWith(".json")) { $response.ContentType = "application/json" }
            else { $response.ContentType = "application/octet-stream" }

            $response.ContentLength64 = $bytes.Length
            $response.OutputStream.Write($bytes, 0, $bytes.Length)
        } else {
            $response.StatusCode = 404
            $errBytes = [System.Text.Encoding]::UTF8.GetBytes("404 - File Not Found")
            $response.OutputStream.Write($errBytes, 0, $errBytes.Length)
        }
        $response.Close()
    }
} finally {
    $listener.Stop()
}
