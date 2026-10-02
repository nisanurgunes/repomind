FROM python:3.11-slim

WORKDIR /app

# Bağımlılıkları kopyala ve kur
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Uygulama kodunu kopyala
COPY . .

# Port
EXPOSE 8000

# Başlatma komutu: önce bekleyen migration'ları uygula, sonra sunucuyu başlat.
# Migration başarısız olursa sunucu hiç başlamaz; Render deploy'u başarısız sayar
# ve çalışan eski sürümü yayında bırakır.
CMD ["sh", "-c", "alembic upgrade head && exec uvicorn app.main:app --host 0.0.0.0 --port 8000"]
