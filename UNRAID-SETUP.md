# Unraid Deployment Guide

This guide covers deploying your Internal Tools application on Unraid with secure environment variable injection and easy manual updates.

## 🎯 Two Deployment Options

### Option 1: Unraid Docker Template (Recommended)
### Option 2: Docker Compose (If you prefer compose files)

---

## Option 1: Unraid Docker Template

### Step 1: Install via Community Applications

1. **Install Community Applications Plugin** (if not already installed)
   - Go to **Apps** tab in Unraid
   - Install "Community Applications" plugin

2. **Add Custom Template**
   - Copy `unraid-template.xml` to `/boot/config/plugins/dockerMan/templates-user/`
   - Or manually add the container via Docker tab

### Step 2: Manual Container Setup

In Unraid Docker tab, click **Add Container**:

**Basic Settings:**
```
Name: internal-tools
Repository: bxe5056/internal-tools:latest
Network Type: bridge
Port Mappings: 3000 → 3000 (TCP)
```

**Environment Variables:**
```
NODE_ENV = production
PORT = 3000
coreAPIToken = your_actual_token_here  (set as MASKED!)
```

**Advanced Settings:**
```
Restart Policy: unless-stopped
Extra Parameters: --health-cmd="node -e \"require('http').get('http://localhost:3000/', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })\""
```

### Step 3: Manual Updates (Simple & Safe)

**To update your container when new versions are available:**

1. **Check for updates** in Unraid Docker tab
2. **Click "Update" button** when available
3. **Or manually pull new image:**
   ```bash
   docker pull bxe5056/internal-tools:latest
   docker stop internal-tools
   docker rm internal-tools
   # Then recreate via Unraid Docker tab
   ```

---

## Option 2: Docker Compose

### Step 1: Prepare Directory Structure

```bash
# SSH into your Unraid server
mkdir -p /mnt/user/appdata/internal-tools
cd /mnt/user/appdata/internal-tools
```

### Step 2: Create Environment File

```bash
# Create secure .env file
echo "APP_PASSWORD=your_actual_token_here" > .env
echo "CORE_API_TOKEN=your_actual_token_here" >> .env
chmod 600 .env
```

### Step 3: Deploy with Compose

```bash
# Copy the unraid-docker-compose.yml to your server
# Then start the services
docker-compose -f unraid-docker-compose.yml up -d
```

### Step 4: Manual Updates

```bash
# When you want to update:
cd /mnt/user/appdata/internal-tools
docker-compose pull
docker-compose up -d
```

---

## 🔒 Security Configuration

### Environment Variable Security

**For Template Method:**
- Set `coreAPIToken` as **MASKED** in Unraid UI
- Token is stored in Unraid's Docker configuration
- Only visible to root user on the system

**For Compose Method:**
- Token stored in `/mnt/user/appdata/internal-tools/.env`
- File permissions: `600` (owner read/write only)
- Never committed to version control

### Network Security

**Optional: Create Custom Network**
```bash
# Create isolated network for your apps
docker network create internal-tools-net

# Update containers to use this network
# Add to container: --net=internal-tools-net
```

---

## 🔄 Manual Updates (Recommended for Personal Projects)

### Why Manual Updates?

✅ **Full control** over when updates happen  
✅ **Test updates** when you're available to fix issues  
✅ **Avoid surprise breakages** during auto-updates  
✅ **Simpler setup** without additional monitoring containers  

### How to Update

**Via Unraid GUI:**
1. Go to **Docker** tab
2. Look for **update icon** next to your container
3. Click **Update** when ready

**Via Command Line:**
```bash
# Pull latest image
docker pull bxe5056/internal-tools:latest

# For template setup:
# Just click "Update" in Unraid Docker tab

# For compose setup:
cd /mnt/user/appdata/internal-tools
docker-compose pull
docker-compose up -d
```

### Update Notifications

**Get notified when updates are available:**
- Enable Unraid notifications in **Settings → Notifications**
- Configure email/Discord/etc. for Docker updates

### Health Monitoring

**Built-in Health Check:**
- Container automatically monitors app health
- Restarts if app becomes unresponsive
- View status in Unraid Docker tab

**Manual Health Check:**
```bash
# Check container status
docker ps | grep internal-tools

# View container logs
docker logs internal-tools

# Check health status
docker inspect internal-tools | grep -A5 Health
```

---

## 🛠️ Troubleshooting

### Container Won't Start

1. **Check logs:**
   ```bash
   docker logs internal-tools
   ```

2. **Verify environment variables:**
   ```bash
   docker exec internal-tools env | grep coreAPIToken
   ```

3. **Check port conflicts:**
   ```bash
   netstat -tlnp | grep :3000
   ```

### Updates Not Showing

1. **Force refresh Docker templates:**
   - Go to **Docker** tab → **Settings** → **Check for Updates**

2. **Manually check for new images:**
   ```bash
   docker pull bxe5056/internal-tools:latest
   ```

3. **Verify your image registry:**
   ```bash
   docker images | grep bxe5056/internal-tools
   ```

### Permission Issues

1. **Fix .env permissions:**
   ```bash
   chmod 600 /mnt/user/appdata/internal-tools/.env
   chown nobody:users /mnt/user/appdata/internal-tools/.env
   ```

2. **Check volume permissions:**
   ```bash
   ls -la /mnt/user/appdata/internal-tools/
   ```

---

## 🔧 Advanced Configuration

### Resource Limits

**Memory Limit:**
```bash
# In Unraid: Extra Parameters
--memory=512m --memory-swap=1g
```

**CPU Limit:**
```bash
# Limit to 2 CPU cores
--cpus=2
```

### Backup Integration

**Automated Backups with CA Backup Plugin:**
1. Install "CA Backup / Restore Appdata" plugin
2. Add `/mnt/user/appdata/internal-tools/` to backup path
3. Schedule regular backups

---

## 📋 Quick Reference

### Useful Commands

```bash
# View all containers
docker ps -a

# Restart internal-tools
docker restart internal-tools

# Update to latest version
docker-compose pull && docker-compose up -d

# View environment variables
docker exec internal-tools env

# Access container shell
docker exec -it internal-tools sh
```

### Important Paths

```
App Data: /mnt/user/appdata/internal-tools/
Logs: docker logs internal-tools
Config: Unraid Docker tab → internal-tools → Edit
```

### Default Ports

```
Application: 3000
Health Check: HTTP GET localhost:3000
```

This setup provides automatic updates while keeping your API token secure and your application highly available on Unraid!
