const express = require("express");
 // 确保安装了node-fetch
const mysql = require("mysql");
const app = express();
const PORT = 3000;

// MySQL数据库连接
const connection = mysql.createConnection({
  host: "127.0.0.1",
  user: "test",
  password: "test",
  database: "test"
});

connection.connect(error => {
  if (error) {
    return console.error(`Error connecting to the database: ${error.stack}`);
  }
  console.log("Connected to the database as id " + connection.threadId);
});

// 解析JSON请求体
app.use(express.json());

// 静态文件服务
app.use(express.static("public"));

// 创建会话
app.post("/create-session", (req, res) => {
  const { sessionName } = req.body;
  if (!sessionName) {
    return res.status(400).json({ error: "Session name is required" });
  }
  const sessionId = Math.floor(Math.random() * 100000).toString(); // 随机生成ID
  const sessionData = JSON.stringify({ conversation: [] }); // 初始化会话数据

  const query = "INSERT INTO sessions (id, session_name, session_data) VALUES (?, ?, ?)";
  connection.query(query, [sessionId, sessionName, sessionData], (error, results) => {
    if (error) {
      return res.status(500).json({ error: error.message });
    }
    res.status(201).send({ sessionId });
  });
});

// 获取会话列表
app.get("/sessions", (req, res) => {
  const query = "SELECT * FROM sessions";
  connection.query(query, (error, results) => {
    if (error) {
      return res.status(500).json({ error: error.message });
    }
    res.send(results);
  });
});

// 获取特定会话
app.get("/sessions/:id", (req, res) => {
  const sessionId = req.params.id;
  const query = "SELECT * FROM sessions WHERE id = ?";
  connection.query(query, [sessionId], (error, results) => {
    if (error) {
      return res.status(500).json({ error: error.message });
    }
    if (results.length === 0) {
      return res.status(404).json({ error: "Session not found" });
    }
    res.send(results[0]);
  });
});

// 更新会话数据
app.post("/update-session", (req, res) => {
  const { sessionId, conversation } = req.body;
  if (!sessionId || !conversation) {
    return res.status(400).json({ error: "Session ID and conversation are required" });
  }
  const sessionData = JSON.stringify({ conversation });

  const query = "UPDATE sessions SET session_data = ? WHERE id = ?";
  connection.query(query, [sessionData, sessionId], (error, results) => {
    if (error) {
      return res.status(500).json({ error: error.message });
    }
    if (results.affectedRows === 0) {
      return res.status(404).json({ error: "Session not found" });
    }
    res.send({ success: true });
  });
});

// 聊天接口
app.post("/chat", async (req, res) => {
  const { message, apiKey } = req.body;
  if (!apiKey) {
    return res.status(400).json({ error: "API Key is required" });
  }

  const response = await fetch("https://api.x.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      messages: [{ role: "user", content: message }],
      model: "grok-beta",
      stream: true,
      temperature: 0,
    }),
  });

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value);
    const lines = chunk.split("\n").filter((line) => line.trim());

    for (const line of lines) {
      if (line.startsWith("data:")) {
        const data = line.slice(5).trim();
        if (data === "[DONE]") break;

        const json = JSON.parse(data);
        const content = json.choices[0].delta.content || "";
        res.write(`data: ${content}\n\n`);
      }
    }
  }

  res.write("data: [DONE]\n\n");
  res.end();
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
