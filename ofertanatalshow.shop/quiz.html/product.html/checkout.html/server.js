const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  credentials: false
}));
app.use(express.json());

const BLACKCAT_API_URL = 'https://api.blackcatpagamentos.com/v1/transactions';
const publicKey = process.env.BLACKCAT_PUBLIC_KEY;
const secretKey = process.env.BLACKCAT_SECRET_KEY;

const NORMAL_SHIPPING_AMOUNT = 6320;
const FAST_SHIPPING_AMOUNT = 7810;

// ROTAS DE API - DEVEM VIR ANTES DOS ARQUIVOS ESTÁTICOS
app.post('/api/create-pix', async (req, res) => {
  try {
    if (!publicKey || !secretKey) {
      console.error('Missing API keys:', { publicKey: !!publicKey, secretKey: !!secretKey });
      return res.status(500).json({
        success: false,
        error: 'Chaves de API não configuradas'
      });
    }

    const { 
      name, 
      email, 
      cpf, 
      phone, 
      cep, 
      street, 
      number, 
      complement, 
      neighborhood, 
      city, 
      state, 
      shipping_type,
      src,
      sck,
      utm_source,
      utm_campaign,
      utm_medium,
      utm_content,
      utm_term
    } = req.body;

    const amount = shipping_type === 'fast' ? FAST_SHIPPING_AMOUNT : NORMAL_SHIPPING_AMOUNT;

    const auth = 'Basic ' + Buffer.from(publicKey + ':' + secretKey).toString('base64');

    const payload = {
      amount: amount,
      currency: 'BRL',
      paymentMethod: 'pix',
      customer: {
        name: name,
        email: email,
        document: {
          type: 'cpf',
          number: cpf.replace(/\D/g, '')
        },
        phone: phone.replace(/\D/g, '')
      },
      items: [
        {
          title: 'Pedido',
          unitPrice: amount,
          quantity: 1,
          tangible: false
        }
      ],
      pix: {
        expiresInSeconds: 900
      },
      metadata: JSON.stringify({
        shipping_type: shipping_type,
        cep: cep,
        street: street,
        number: number,
        complement: complement || '',
        neighborhood: neighborhood,
        city: city,
        state: state,
        src: src,
        sck: sck,
        utm_source: utm_source,
        utm_campaign: utm_campaign,
        utm_medium: utm_medium,
        utm_content: utm_content,
        utm_term: utm_term
      })
    };

    console.log('Creating PIX transaction:', { amount, shipping_type, customer: payload.customer.name });

    const response = await fetch(BLACKCAT_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': auth,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    console.log('BlackCat response:', JSON.stringify(data, null, 2));

    if (data.id) {
      res.json({
        success: true,
        transaction_id: data.id,
        pix_code: data.pix?.qrcode || data.pix?.qrCode || data.pix?.copyPaste || data.pixQrCode || data.pixCopyPaste,
        amount: amount,
        status: data.status
      });
    } else {
      res.json({
        success: false,
        error: data.message || 'Erro ao criar transação PIX'
      });
    }
  } catch (error) {
    console.error('Error creating PIX:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

app.post('/api/check-status', async (req, res) => {
  try {
    const { transaction_id } = req.body;

    if (!transaction_id) {
      return res.status(400).json({
        success: false,
        error: 'Transaction ID is required'
      });
    }

    const auth = 'Basic ' + Buffer.from(publicKey + ':' + secretKey).toString('base64');

    const response = await fetch(`${BLACKCAT_API_URL}/${transaction_id}`, {
      method: 'GET',
      headers: {
        'Authorization': auth,
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json();
    console.log('Status check response:', data);

    res.json({
      success: true,
      data: {
        transaction_id: data.id,
        status: data.status,
        paid_at: data.paidAt
      }
    });
  } catch (error) {
    console.error('Error checking status:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao verificar status'
    });
  }
});

// ARQUIVOS ESTÁTICOS - DEPOIS DAS ROTAS DE API
app.use(express.static(path.join(__dirname, '.')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Captura todas as outras rotas e serve index.html (importante para SPAs)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

const PORT = 5000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
  console.log('BlackCat API configured:', publicKey ? 'Yes' : 'No - Missing API keys!');
});
