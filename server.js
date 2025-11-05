import express from "express";
import axios from "axios";
import cors from "cors";

const app = express();
const webhookStatusStore = {};
app.use(cors());
app.use(express.json());

// ✅ Credenciais da sua conta Instapay
const CLIENT_ID = "pabloguilhermeandradedossantos_488FDE45";
const CLIENT_SECRET = "a1a919ef46836d37415a97431d60b97b0c0bfc751b4a9d088bbcb6b6fc7b42053ccc5ff6062350733949e700f2242f380d33";

// ✅ Base URL oficial
const BASE_URL = "https://api.instapaybr.com";

// 🔐 Função para obter token JWT
async function getAccessToken() {
  try {
    const { data } = await axios.post(`${BASE_URL}/api/auth/login`, {
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
    });
    console.log("✅ Token JWT gerado com sucesso");
    return data.token;
  } catch (error) {
    console.error("❌ Erro ao gerar token:", error.response?.data || error.message);
    throw new Error("Falha na autenticação");
  }
}

// 💰 Criar pagamento PIX
app.post("/create-pix", async (req, res) => {
  try {
    const { amount, name, email } = req.body;
    const token = await getAccessToken();

    const payload = {
      amount,
      external_id: `checkout_${Date.now()}`,
      clientCallbackUrl: "https://snapless-amiya-unmaidenlike.ngrok-free.dev/instapay-webhook",
      payer: {
        name,
        email,
        document: "12345678901",
      },
    };

    console.log("➡️ Enviando payload para Instapay:", payload);

    const response = await axios.post(
      `${BASE_URL}/api/payments/deposit`,
      payload,
      {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 15000, // 15 segundos
        validateStatus: () => true // mostra mesmo respostas de erro
      }
    );

    console.log("⬅️ Resposta recebida:", response.status, response.data);

    // envia tudo da Instapay direto pro front
    res.json({
      success: true,
      ...response.data
    });
  } catch (error) {
    console.error("❌ Erro Instapay (detalhado):");
    if (error.response) {
      console.error("Status:", error.response.status);
      console.error("Data:", error.response.data);
    } else {
      console.error("Mensagem:", error.message);
    }
    res.status(500).json({ error: "Erro ao criar pagamento Pix" });
  }
});

/*
  Nova rota: verificar status do pagamento pela transactionId.
  Tenta algumas variações comuns no endpoint de status (GET query, GET id, POST).
  Retorna o JSON recebido da Instapay para o front.
*/
app.get("/payment-status/:transactionId", async (req, res) => {
  const { transactionId } = req.params;

  try {
    const token = await getAccessToken();

    const { data } = await axios.get(
      `${BASE_URL}/api/transactions/getStatusTransac/${transactionId}`,
      {
        headers: { Authorization: `Bearer ${token}` }
      }
    );

    // data = { status: "PENDING" }
    return res.json({ success: true, status: data.status });

  } catch (err) {
    console.error("Erro ao consultar status:", err.response?.data || err.message);
    return res.status(500).json({ success: false });
  }
});

app.post("/instapay-webhook", (req, res) => {
  console.log("📩 Webhook recebido:", req.body);

  const { transaction_id, transactionId, status } = req.body;

  // Garantir que a chave sempre exista (camelCase ou snake_case)
  const txId = transactionId || transaction_id;

  if (txId) {
    webhookStatusStore[txId] = status;
    console.log("✅ Status salvo:", txId, status);
  } else {
    console.log("⚠️ Webhook recebido sem transactionId.");
  }


  res.status(200).send("OK");
});

app.get("/check-payment-local/:transactionId", (req, res) => {
  const { transactionId } = req.params;
  const status = webhookStatusStore[transactionId] || "PENDING";
  res.json({ status });
});



app.listen(3000, () => console.log("✅ Servidor rodando em http://localhost:3000"));
