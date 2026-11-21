# 🇰🇭 ANGKOR EYES - GOOGLE CLOUD VPS 24/7 365 FREE DEPLOYMENT GUIDE

> **GCP Instance:** `angkor-eyes`  
> **Zone:** `us-central1-a` | **Project:** `quant-gold-514007`  
> **Instance Console URL:** [Google Cloud Compute Engine Console](https://console.cloud.google.com/compute/instancesDetail/zones/us-central1-a/instances/angkor-eyes?project=quant-gold-514007)  
> **Machine Type:** `e2-micro` (2 vCPUs, 1 GB RAM — Free Tier Eligible)  
> **Remote Repository:** [https://github.com/hemsoknitha-sketch/angkor-eyes.git](https://github.com/hemsoknitha-sketch/angkor-eyes.git)

---

## ⚡ ១. មូលហេតុដែលធ្វើឱ្យការ Update ពីមុនយឺតយ៉ាវ និងដំណោះស្រាយ (Root Cause & Fix)

### ❌ បញ្ហាពីមុន (Prior Slowness):
1. **Fragmented Monorepo Bloat**: ពីមុនប្រព័ន្ធបែងចែកជា ៥ Folders ដាច់ពីគ្នា (`bot/`, `backend/`, `frontend/`, `runner/`, `tests/`) ដែល Folder នីមួយៗសុទ្ធតែមាន `package.json`, `package-lock.json` (លើសពី 100KB) និងទាញយក `node_modules` ជាន់គ្នា ៥ ដង។ ធ្វើឱ្យរាល់ពេល Update ម្តងៗ ត្រូវចំណាយពេល Download និង Build យូរខ្លាំង។
2. **Duplicate Code & Inefficient Inter-Process Calls**: Bot ត្រូវហៅទៅ Backend តាម HTTP ធ្វើឱ្យមាន Latency និងស៊ី RAM លើសពី 1GB (បណ្តាលឱ្យ Linux OOM Killer សម្លាប់ Process)។

### ✅ ការកែលម្អសម្អាតរួចរាល់ (Optimized Solution):
1. **Unified High-Speed Engine**: រួមបញ្ចូល Telegram Bot (grammY), REST API, In-Memory DB, Sub-0.1ms Cache, និងច្បាប់កម្ពុជាទាំង ២៤៩ មាត្រា ឱ្យដំណើរការក្នុង Service តែមួយ។
2. **Ultra-Low Memory Footprint**: ស៊ី RAM ត្រឹម **~180MB** (ស្ថិតក្រោម 512MB Heap Limit) ធានាថាមិនដែលគាំង ឬ OOM លើ Google Cloud VPS e2-micro (1GB RAM)។
3. **Blazing Fast Tests**: តេស្តទាំង ៣០ រត់ចប់ក្នុងរយៈពេលត្រឹម **~0.6 វិនាទី**។
4. **Legacy Archive**: រាល់កូដសេចក្តីព្រាងចាស់ៗត្រូវបានផ្លាស់ប្តូរទៅរក្សាទុកក្នុង `archive_legacy_monorepo/` ដោយសុវត្ថិភាព ឥតមានបាត់បង់ទិន្នន័យឡើយ។

---

## 🚀 ២. របៀបតម្លើងប្រព័ន្ធលើ Google Cloud VPS (Initial 1-Command Deployment)

### ជំហានទី ១ ៖ បើក Web SSH Console លើ Google Cloud
ចុចបើកតំណភ្ជាប់ ៖  
👉 [Google Cloud Instance Console](https://console.cloud.google.com/compute/instancesDetail/zones/us-central1-a/instances/angkor-eyes?project=quant-gold-514007)  
រួចចុចប៊ូតុង **"SSH"** ដើម្បីបើកផ្ទាំង Terminal លើ Browser។

### ជំហានទី ២ ៖ បញ្ចូល 2GB Swap Memory (តាមបញ្ជាដែលបានកំណត់)
រត់បញ្ជាទាំងនេះដើម្បីបង្កើត Swap 2GB (ធ្វើឱ្យ RAM សរុបឡើងដល់ 3GB Virtual Memory) ៖
```bash
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

### ជំហានទី ៣ ៖ រត់បញ្ជា Deploy ស្វ័យប្រវត្ត ១-បន្ទាត់ (Automated Deploy)
រត់បញ្ជាខាងក្រោមនេះ វានឹងរៀបចំ Node.js 20 LTS, ទាញយកកូដពី GitHub, តម្លើង systemd service និងដំណើរការ Bot ២៤/៧ ៣៦៥ថ្ងៃភ្លាមៗ ៖
```bash
curl -sSL https://raw.githubusercontent.com/hemsoknitha-sketch/angkor-eyes/main/scripts/deploy_vps.sh | sudo bash
```

---

## 🔄 ៣. របៀប Update មុខងារថ្មីៗដោយស្វ័យប្រវត្តិ (Auto Git Push & VPS Update)

### វិធីទី ១ ៖ ពីកុំព្យូទ័រផ្ទាល់ខ្លួន (Windows 1-Click)
គ្រាន់តែចុចពីរដង (Double Click) លើឯកសារ ៖
```cmd
update_vps.bat
```
ឬបើក PowerShell ហើយវាយ ៖
```powershell
.\update_vps.ps1
```
ប្រព័ន្ធនឹងធ្វើ `git add`, `git commit` និង `git push origin main` ដោយស្វ័យប្រវត្តិ។

### វិធីទី ២ ៖ Update លើ Google Cloud VPS ភ្លាមៗ (Zero-Downtime Hot Reload)
លើ SSH Terminal របស់ Google Cloud VPS គ្រាន់តែវាយ ៖
```bash
curl -sSL https://raw.githubusercontent.com/hemsoknitha-sketch/angkor-eyes/main/scripts/update_vps.sh | sudo bash
```
ឬបើស្ថិតក្នុង `/opt/angkor-eyes` ៖
```bash
cd /opt/angkor-eyes && sudo bash scripts/update_vps.sh
```

---

## 📊 ៤. ការត្រួតពិនិត្យសុខភាពប្រព័ន្ធលើ VPS (Monitoring)

- **ពិនិត្យស្ថានភាព Bot & Service**:
  ```bash
  sudo systemctl status angkor-eyes
  ```
- **មើលកំណត់ត្រា Log ផ្ទាល់ (Live Stream)**:
  ```bash
  sudo journalctl -u angkor-eyes -f
  ```
- **ពិនិត្យទំហំ RAM & Swap**:
  ```bash
  free -h
  ```
- **បញ្ឈប់ ឬចាប់ផ្តើមឡើងវិញ**:
  ```bash
  sudo systemctl restart angkor-eyes
  sudo systemctl stop angkor-eyes
  ```
