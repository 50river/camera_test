// Deployment configuration for Receipt OCR PWA
export default {
  // Static hosting configuration (Netlify, Vercel, etc.)
  static: {
    // Build output directory
    buildDir: 'dist',
    
    // Headers for security and performance
    headers: {
      '/*': [
        'X-Frame-Options: DENY',
        'X-Content-Type-Options: nosniff',
        'X-XSS-Protection: 1; mode=block',
        'Referrer-Policy: strict-origin-when-cross-origin',
        'Permissions-Policy: camera=(), microphone=(), geolocation=()'
      ],
      
      // Cache static assets for 1 year
      '/assets/*': [
        'Cache-Control: public, max-age=31536000, immutable'
      ],
      
      // Cache ONNX models for 1 month
      '/models/*': [
        'Cache-Control: public, max-age=2592000'
      ],
      
      // Cache service worker for 1 day
      '/sw.js': [
        'Cache-Control: public, max-age=86400'
      ],
      
      // Don't cache HTML files
      '/*.html': [
        'Cache-Control: public, max-age=0, must-revalidate'
      ],
      
      // Enable CORS for WebWorkers and WASM
      '/*.js': [
        'Cross-Origin-Embedder-Policy: require-corp',
        'Cross-Origin-Opener-Policy: same-origin'
      ],
      
      '/*.wasm': [
        'Cross-Origin-Embedder-Policy: require-corp',
        'Cross-Origin-Opener-Policy: same-origin'
      ]
    },
    
    // Redirects for SPA routing
    redirects: [
      {
        from: '/*',
        to: '/index.html',
        status: 200
      }
    ],
    
    // Environment variables
    env: {
      NODE_ENV: 'production',
      VITE_APP_VERSION: process.env.npm_package_version || '1.0.0',
      VITE_BUILD_TIME: new Date().toISOString()
    }
  },
  
  // Netlify specific configuration
  netlify: {
    // Build command
    build: {
      command: 'npm run build:prod',
      publish: 'dist'
    },
    
    // Functions (if needed)
    functions: {
      directory: 'netlify/functions'
    },
    
    // Edge functions (if needed)
    edge_functions: {
      directory: 'netlify/edge-functions'
    }
  },
  
  // Vercel specific configuration
  vercel: {
    // Build configuration
    builds: [
      {
        src: 'package.json',
        use: '@vercel/static-build',
        config: {
          buildCommand: 'npm run build:prod',
          outputDirectory: 'dist'
        }
      }
    ],
    
    // Routes configuration
    routes: [
      {
        src: '/sw.js',
        headers: {
          'Cache-Control': 'public, max-age=86400'
        }
      },
      {
        src: '/assets/(.*)',
        headers: {
          'Cache-Control': 'public, max-age=31536000, immutable'
        }
      },
      {
        src: '/(.*)',
        dest: '/index.html'
      }
    ]
  },
  
  // GitHub Pages configuration
  github: {
    // Build and deploy workflow
    workflow: {
      name: 'Build and Deploy',
      on: {
        push: {
          branches: ['main']
        }
      },
      jobs: {
        build: {
          'runs-on': 'ubuntu-latest',
          steps: [
            {
              uses: 'actions/checkout@v3'
            },
            {
              uses: 'actions/setup-node@v3',
              with: {
                'node-version': '18',
                cache: 'npm'
              }
            },
            {
              run: 'npm ci'
            },
            {
              run: 'npm run build:prod'
            },
            {
              uses: 'actions/upload-pages-artifact@v2',
              with: {
                path: 'dist'
              }
            }
          ]
        },
        deploy: {
          'runs-on': 'ubuntu-latest',
          needs: 'build',
          permissions: {
            pages: 'write',
            'id-token': 'write'
          },
          environment: {
            name: 'github-pages',
            url: '${{ steps.deployment.outputs.page_url }}'
          },
          steps: [
            {
              id: 'deployment',
              uses: 'actions/deploy-pages@v2'
            }
          ]
        }
      }
    }
  },
  
  // Docker configuration
  docker: {
    // Dockerfile for containerized deployment
    dockerfile: `
FROM nginx:alpine

# Copy built application
COPY dist/ /usr/share/nginx/html/

# Copy nginx configuration
COPY nginx.conf /etc/nginx/nginx.conf

# Expose port
EXPOSE 80

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
    `,
    
    // Nginx configuration
    nginx: `
events {
    worker_connections 1024;
}

http {
    include       /etc/nginx/mime.types;
    default_type  application/octet-stream;
    
    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/xml+rss application/json;
    
    # Security headers
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    add_header Referrer-Policy strict-origin-when-cross-origin;
    
    server {
        listen 80;
        server_name localhost;
        root /usr/share/nginx/html;
        index index.html;
        
        # Enable CORS for WebWorkers
        location ~* \\.(js|wasm)$ {
            add_header Cross-Origin-Embedder-Policy require-corp;
            add_header Cross-Origin-Opener-Policy same-origin;
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
        
        # Cache static assets
        location /assets/ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
        
        # Cache ONNX models
        location /models/ {
            expires 30d;
            add_header Cache-Control "public";
        }
        
        # Service worker
        location /sw.js {
            expires 1d;
            add_header Cache-Control "public";
        }
        
        # SPA routing
        location / {
            try_files $uri $uri/ /index.html;
            expires -1;
            add_header Cache-Control "public, max-age=0, must-revalidate";
        }
    }
}
    `
  }
}