# Deployment Guide

This document provides instructions for deploying the Receipt OCR PWA to various hosting platforms.

## Prerequisites

- Node.js 18+ installed
- npm or yarn package manager
- Built application (`npm run build:prod`)

## Build for Production

```bash
# Install dependencies
npm install

# Run production build with optimizations
npm run build:prod

# Or use the standard build
npm run build
```

The production build includes:
- TypeScript compilation
- Bundle optimization and minification
- PWA manifest and service worker
- Asset optimization
- Bundle analysis
- Build report generation

## Deployment Options

### 1. Netlify

#### Automatic Deployment (Recommended)

1. Connect your repository to Netlify
2. Configure build settings:
   - **Build command**: `npm run build:prod`
   - **Publish directory**: `dist`
   - **Node version**: `18`

3. Add environment variables (if needed):
   ```
   NODE_ENV=production
   ```

4. Configure headers in `netlify.toml`:
   ```toml
   [[headers]]
     for = "/*"
     [headers.values]
       X-Frame-Options = "DENY"
       X-Content-Type-Options = "nosniff"
       X-XSS-Protection = "1; mode=block"
       Referrer-Policy = "strict-origin-when-cross-origin"

   [[headers]]
     for = "/assets/*"
     [headers.values]
       Cache-Control = "public, max-age=31536000, immutable"

   [[headers]]
     for = "/models/*"
     [headers.values]
       Cache-Control = "public, max-age=2592000"

   [[redirects]]
     from = "/*"
     to = "/index.html"
     status = 200
   ```

#### Manual Deployment

```bash
# Install Netlify CLI
npm install -g netlify-cli

# Build the application
npm run build:prod

# Deploy to Netlify
netlify deploy --prod --dir=dist
```

### 2. Vercel

#### Automatic Deployment

1. Connect your repository to Vercel
2. Configure build settings:
   - **Framework Preset**: Vite
   - **Build Command**: `npm run build:prod`
   - **Output Directory**: `dist`

3. Add `vercel.json` configuration:
   ```json
   {
     "builds": [
       {
         "src": "package.json",
         "use": "@vercel/static-build",
         "config": {
           "buildCommand": "npm run build:prod",
           "outputDirectory": "dist"
         }
       }
     ],
     "routes": [
       {
         "src": "/sw.js",
         "headers": {
           "Cache-Control": "public, max-age=86400"
         }
       },
       {
         "src": "/assets/(.*)",
         "headers": {
           "Cache-Control": "public, max-age=31536000, immutable"
         }
       },
       {
         "src": "/(.*)",
         "dest": "/index.html"
       }
     ]
   }
   ```

#### Manual Deployment

```bash
# Install Vercel CLI
npm install -g vercel

# Build the application
npm run build:prod

# Deploy to Vercel
vercel --prod
```

### 3. GitHub Pages

1. Enable GitHub Pages in repository settings
2. Create `.github/workflows/deploy.yml`:
   ```yaml
   name: Build and Deploy
   on:
     push:
       branches: [ main ]
   
   jobs:
     build:
       runs-on: ubuntu-latest
       steps:
         - uses: actions/checkout@v3
         - uses: actions/setup-node@v3
           with:
             node-version: '18'
             cache: 'npm'
         - run: npm ci
         - run: npm run build:prod
         - uses: actions/upload-pages-artifact@v2
           with:
             path: dist
   
     deploy:
       runs-on: ubuntu-latest
       needs: build
       permissions:
         pages: write
         id-token: write
       environment:
         name: github-pages
         url: ${{ steps.deployment.outputs.page_url }}
       steps:
         - id: deployment
           uses: actions/deploy-pages@v2
   ```

### 4. Firebase Hosting

```bash
# Install Firebase CLI
npm install -g firebase-tools

# Login to Firebase
firebase login

# Initialize Firebase in your project
firebase init hosting

# Configure firebase.json
{
  "hosting": {
    "public": "dist",
    "ignore": [
      "firebase.json",
      "**/.*",
      "**/node_modules/**"
    ],
    "rewrites": [
      {
        "source": "**",
        "destination": "/index.html"
      }
    ],
    "headers": [
      {
        "source": "/assets/**",
        "headers": [
          {
            "key": "Cache-Control",
            "value": "public, max-age=31536000, immutable"
          }
        ]
      },
      {
        "source": "/models/**",
        "headers": [
          {
            "key": "Cache-Control",
            "value": "public, max-age=2592000"
          }
        ]
      }
    ]
  }
}

# Build and deploy
npm run build:prod
firebase deploy
```

### 5. Docker Deployment

1. Create `Dockerfile`:
   ```dockerfile
   FROM nginx:alpine
   
   # Copy built application
   COPY dist/ /usr/share/nginx/html/
   
   # Copy nginx configuration
   COPY nginx.conf /etc/nginx/nginx.conf
   
   # Expose port
   EXPOSE 80
   
   # Start nginx
   CMD ["nginx", "-g", "daemon off;"]
   ```

2. Create `nginx.conf`:
   ```nginx
   events {
       worker_connections 1024;
   }
   
   http {
       include       /etc/nginx/mime.types;
       default_type  application/octet-stream;
       
       gzip on;
       gzip_vary on;
       gzip_min_length 1024;
       gzip_types text/plain text/css text/xml text/javascript application/javascript application/xml+rss application/json;
       
       server {
           listen 80;
           server_name localhost;
           root /usr/share/nginx/html;
           index index.html;
           
           location ~* \.(js|wasm)$ {
               add_header Cross-Origin-Embedder-Policy require-corp;
               add_header Cross-Origin-Opener-Policy same-origin;
               expires 1y;
               add_header Cache-Control "public, immutable";
           }
           
           location /assets/ {
               expires 1y;
               add_header Cache-Control "public, immutable";
           }
           
           location /models/ {
               expires 30d;
               add_header Cache-Control "public";
           }
           
           location / {
               try_files $uri $uri/ /index.html;
               expires -1;
               add_header Cache-Control "public, max-age=0, must-revalidate";
           }
       }
   }
   ```

3. Build and run:
   ```bash
   # Build the application
   npm run build:prod
   
   # Build Docker image
   docker build -t receipt-ocr .
   
   # Run container
   docker run -p 80:80 receipt-ocr
   ```

## Performance Optimization

### Bundle Analysis

```bash
# Analyze bundle size
npm run analyze

# Generate lighthouse report
npm run lighthouse
```

### Caching Strategy

The application uses a multi-layer caching strategy:

1. **Browser Cache**: Static assets cached for 1 year
2. **Service Worker Cache**: Critical resources cached offline
3. **CDN Cache**: Global edge caching (if using CDN)

### Model Optimization

ONNX models are large files. Consider:

1. **Model Compression**: Use quantized models if available
2. **Lazy Loading**: Models are loaded on-demand
3. **CDN Hosting**: Host models on a fast CDN
4. **Progressive Loading**: Show UI while models load

## Security Considerations

### Content Security Policy

The application includes a strict CSP header:

```
default-src 'self';
script-src 'self' 'unsafe-inline' 'unsafe-eval' blob:;
style-src 'self' 'unsafe-inline';
img-src 'self' data: blob:;
worker-src 'self' blob:;
```

### HTTPS Requirements

- **Required**: PWA features require HTTPS
- **Service Worker**: Only works over HTTPS
- **Camera Access**: Requires secure context

### Privacy

- **No Server Communication**: All processing is client-side
- **No Data Collection**: No analytics or tracking
- **Local Storage Only**: Data stays on device

## Monitoring and Analytics

### Performance Monitoring

```bash
# Generate performance report
npm run lighthouse

# Monitor bundle size
npm run analyze
```

### Error Tracking

Consider adding error tracking:

```javascript
// Optional: Add error tracking service
window.addEventListener('error', (event) => {
  // Log to your error tracking service
  console.error('Application error:', event.error)
})
```

## Troubleshooting

### Common Issues

1. **ONNX Models Not Loading**
   - Check CORS headers
   - Verify model file paths
   - Check network connectivity

2. **Service Worker Issues**
   - Clear browser cache
   - Check console for errors
   - Verify HTTPS deployment

3. **Camera Not Working**
   - Ensure HTTPS deployment
   - Check browser permissions
   - Verify device compatibility

### Debug Mode

Enable debug mode by adding to URL:
```
?debug=true
```

This enables:
- Verbose console logging
- Performance metrics
- Error details

## Support

For deployment issues:

1. Check the build logs
2. Verify all required files are present
3. Test locally with `npm run serve`
4. Check browser console for errors
5. Verify PWA requirements with Lighthouse