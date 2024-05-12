#include <driver/i2s.h>
#include <WiFi.h>
#include <ArduinoWebsockets.h>
#include <SPIFFS.h> // For file operations
#include <FS.h>

#define I2S_SD 19
#define I2S_WS 23
#define I2S_SCK 22
#define I2S_PORT I2S_NUM_0

#define bufferCnt 10
#define bufferLen 1024
int16_t sBuffer[bufferLen];

const char* ssid = "ZONG4G-9B1B";
const char* password = "09156110";

const char* websocket_server_host = "192.168.8.101";
const uint16_t websocket_server_port = 8888;  // <WEBSOCKET_SERVER_PORT>

using namespace websockets;
WebsocketsClient client;
bool isWebSocketConnected;

File wavFile;
unsigned long lastFileSaveTime = 0;
const unsigned long saveInterval = 10000; // 10 seconds

void onEventsCallback(WebsocketsEvent event, String data) {
  if (event == WebsocketsEvent::ConnectionOpened) {
    Serial.println("Connnection Opened");
    isWebSocketConnected = true;
  } else if (event == WebsocketsEvent::ConnectionClosed) {
    Serial.println("Connnection Closed");
    isWebSocketConnected = false;
  } else if (event == WebsocketsEvent::GotPing) {
    Serial.println("Got a Ping!");
  } else if (event == WebsocketsEvent::GotPong) {
    Serial.println("Got a Pong!");
  }
}

void i2s_install() {
  // Set up I2S Processor configuration
  const i2s_config_t i2s_config = {
    .mode = i2s_mode_t(I2S_MODE_MASTER | I2S_MODE_RX),
    .sample_rate = 44100,
    .bits_per_sample = i2s_bits_per_sample_t(16),
    .channel_format = I2S_CHANNEL_FMT_ONLY_LEFT,
    .communication_format = i2s_comm_format_t(I2S_COMM_FORMAT_STAND_I2S),
    .intr_alloc_flags = 0,
    .dma_buf_count = bufferCnt,
    .dma_buf_len = bufferLen,
    .use_apll = false
  };

  i2s_driver_install(I2S_PORT, &i2s_config, 0, NULL);
}

void i2s_setpin() {
  // Set I2S pin configuration
  const i2s_pin_config_t pin_config = {
    .bck_io_num = I2S_SCK,
    .ws_io_num = I2S_WS,
    .data_out_num = -1,
    .data_in_num = I2S_SD
  };

  i2s_set_pin(I2S_PORT, &pin_config);
}

void setup() {
  Serial.begin(115200);

  // Initialize SPIFFS
  if (!SPIFFS.begin(true)) {
    Serial.println("SPIFFS initialization failed!");
    return;
  }

  connectWiFi();
  connectWSServer();
  xTaskCreatePinnedToCore(micTask, "micTask", 10000, NULL, 1, NULL, 1);
}

void loop() {
}

void connectWiFi() {
  WiFi.begin(ssid, password);

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("");
  Serial.println("WiFi connected");
}

void connectWSServer() {
  client.onEvent(onEventsCallback);
  while (!client.connect(websocket_server_host, websocket_server_port, "/")) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("Websocket Connected!");
}

void micTask(void* parameter) {
  i2s_install();
  i2s_setpin();
  i2s_start(I2S_PORT);

  size_t bytesIn = 0;
  while (1) {
    esp_err_t result = i2s_read(I2S_PORT, &sBuffer, bufferLen, &bytesIn, portMAX_DELAY);
    if (result == ESP_OK && isWebSocketConnected) {
      client.sendBinary((const char*)sBuffer, bytesIn);

      // Check if it's time to save the audio to a WAV file
      if (millis() - lastFileSaveTime >= saveInterval) {
        saveAudioToFile();
        lastFileSaveTime = millis();
      }
    }
  }
}

void saveAudioToFile() {
  // Create a unique filename based on current time
  String filename = "/temp/audio_" + String(millis()) + ".wav";
  wavFile = SPIFFS.open(filename, "w");

  // Write WAV file header (assuming mono, 16-bit PCM format)
  uint8_t header[44];
  strncpy((char*)header, "RIFF", 4);
  *(uint32_t*)(header + 4) = 0; // Placeholder for file size (will be filled later)
  strncpy((char*)(header + 8), "WAVEfmt ", 8);
  *(uint32_t*)(header + 16) = 16; // Format chunk length
  *(uint16_t*)(header + 20) = 1; // Audio format (PCM)
  *(uint16_t*)(header + 22) = 1; // Number of channels
  *(uint32_t*)(header + 24) = 44100; // Sample rate (44100 Hz)
  *(uint32_t*)(header + 28) = 44100 * 1 * 2; // Byte rate (sample rate * channels * bytes per sample)
  *(uint16_t*)(header + 32) = 1 * 2; // Block align (channels * bytes per sample)
  *(uint16_t*)(header + 34) = 16; // Bits per sample
  strncpy((char*)(header + 36), "data", 4);
  *(uint32_t*)(header + 40) = 0; // Placeholder for data size (will be filled later)
  
  wavFile.write(header, 44); // Write the header to the file
}
