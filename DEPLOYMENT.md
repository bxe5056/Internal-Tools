# Drone CI Deployment Setup

This document provides instructions for deploying your TanStack Start application using Drone CI on your NAS with Docker containers.

## Files Created

1. **`Dockerfile`** - Multi-stage Docker build for production deployment
2. **`.drone.yml`** - Drone CI pipeline configuration
3. **`.dockerignore`** - Optimizes Docker build by excluding unnecessary files
4. **`docker-compose.yml`** - Optional compose file for local/manual deployment

## Prerequisites

1. **Drone CI Server** running on your NAS
2. **Docker** installed on your NAS
3. **Git repository** connected to Drone CI
4. **Docker registry** (optional, can use Docker Hub or local registry)

## Setup Instructions

### 1. Drone CI Configuration

Configure these secrets in your Drone CI dashboard (`Settings > Secrets`):

```bash
# Docker Hub credentials (required for pushing to bentheitguy/internal-tools)
docker_username: bentheitguy
docker_token: your-docker-hub-personal-access-token

# NAS deployment credentials (for SSH deployment)
nas_host: your-nas-ip-address
nas_username: your-nas-ssh-username
nas_ssh_key: |
  -----BEGIN OPENSSH PRIVATE KEY-----
  your-private-ssh-key-content
  -----END OPENSSH PRIVATE KEY-----

# Application secrets
coreAPIToken: your-basic-auth-token-value
```

**Important**: 
- The `coreAPIToken` should contain your actual Basic auth token value that your application uses for API authentication.
- For `docker_token`, use a Docker Hub **Personal Access Token** (strongly recommended). Get a token at: https://hub.docker.com/settings/security

### 2. Customize .drone.yml

Update the following sections in `.drone.yml` to match your setup:

#### Docker Registry Configuration
Uncomment and configure if using a local registry:
```yaml
registry: your-nas-registry:5000
username:
  from_secret: docker_username
password:
  from_secret: docker_password
```

#### Deployment Path
Update the deployment script path:
```yaml
script:
  - cd /path/to/your/deployment/directory  # Change this path
  - docker compose pull
  - docker compose up -d
```

### 3. NAS Setup

On your NAS, create the deployment directory:
```bash
mkdir -p /path/to/your/deployment/directory
cd /path/to/your/deployment/directory
```

Copy or create a `docker-compose.yml` file in this directory (you can use the one generated).

### 4. Port Configuration

The application runs on port 3000 by default. You can:
- Keep it as is and access via `http://your-nas-ip:3000`
- Use a reverse proxy (nginx, traefik) to serve on port 80/443
- Modify the port mapping in `docker-compose.yml`

## Pipeline Workflow

The Drone CI pipeline performs these steps:

1. **Build**: Install dependencies and build the application
2. **Test**: Run tests (if available)
3. **Docker Build**: Create and tag Docker image
4. **Deploy**: SSH to NAS and update the running container

## Manual Deployment (Alternative)

If you prefer manual deployment without the SSH step:

1. Build and push the image manually:
```bash
docker build -t bentheitguy/internal-tools .
docker tag bentheitguy/internal-tools your-registry/bentheitguy/internal-tools:latest
docker push your-registry/bentheitguy/internal-tools:latest
```

2. On your NAS:
```bash
docker compose pull
docker compose up -d
```

## Environment Variables & Security

### Secure Environment Variable Handling

Your application uses sensitive environment variables like `coreAPIToken`. The deployment is configured to handle these securely:

1. **In Drone CI**: Secrets are stored in Drone's secret management system
2. **During Deployment**: Secrets are written to a `.env` file on your NAS (never committed to git)
3. **In Container**: Environment variables are passed securely to the running container

### Environment Variable Configuration

The application automatically loads these environment variables:

```yaml
# In docker-compose.yml
environment:
  - NODE_ENV=production
  - PORT=3000
  - coreAPIToken=${CORE_API_TOKEN}  # Loaded from .env file
```

### Manual Environment Setup (Alternative)

If you're not using the Drone CI pipeline, you can manually create a `.env` file on your NAS:

```bash
# Create .env file in your deployment directory
echo "CORE_API_TOKEN=your_actual_basic_auth_token_here" > .env

# Ensure proper permissions (readable only by owner)
chmod 600 .env
```

**Security Notes**:
- Never commit `.env` files to git (already in `.gitignore`)
- Use proper file permissions (`600`) for `.env` files
- Rotate API tokens regularly
- Use different tokens for development vs production

## Troubleshooting

### Build Fails
- Check Node.js version compatibility (currently using Node 20)
- Verify all dependencies are in `package.json`
- Check build logs for missing environment variables

### Container Won't Start
- Check logs: `docker compose logs internal-tools`
- Verify port 3000 is not already in use
- Ensure proper file permissions

### SSH Deployment Fails
- Verify SSH key format and permissions
- Check NAS firewall settings
- Ensure Docker and Docker Compose are installed on NAS

### Environment Variable Issues
- **Token not working**: Verify `coreAPIToken` secret is set correctly in Drone CI
- **Container fails to start**: Check `.env` file exists and has correct permissions
- **API calls failing**: Verify the token format matches what your API expects
- **Local development**: Create a local `.env` file with `CORE_API_TOKEN=your_token`

## Health Check

The Docker container includes a health check that verifies the application is responding on port 3000. You can check the health status with:

```bash
docker compose ps
```

## Scaling and Production Considerations

For production use, consider:
- Setting up a reverse proxy (nginx/traefik)
- Implementing proper logging and monitoring
- Setting up SSL/TLS certificates
- Configuring backups for persistent data
- Using Docker secrets for sensitive data

## Support

If you encounter issues:
1. Check Drone CI build logs
2. Verify Docker container logs
3. Ensure all secrets are properly configured
4. Test manual Docker build locally first
