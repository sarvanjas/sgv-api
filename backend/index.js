// index.js
require('dotenv').config();
const express = require("express");
const { Pool } = require("pg");


const app = express();
const PORT = 3000;

// Middleware to parse JSON
app.use(express.json());

// Middleware to check API key (header OR query param)
app.use((req, res, next) => {
  const keyFromHeader = req.headers['x-api-key'];
  const keyFromQuery = req.query.api_key;

  if (keyFromHeader !== process.env.API_KEY && keyFromQuery !== process.env.API_KEY) {
    return res.status(403).json({ error: 'Forbidden - Invalid API Key' });
  }
  next();
});


// Database connection pool
const pool = new Pool({
  user: process.env.DB_USER,        // your PostgreSQL username
  host: process.env.DB_HOST,       // database host
  database: process.env.DB_NAME,      // your database name
  password: process.env.DB_PASS,    // your PostgreSQL password
  port: process.env.DB_PORT,

  ssl: {
    require: true,
    rejectUnauthorized: false // allows self-signed certs
  }
});

// Test route
app.get("/", (req, res) => {
  res.send("Welcome to My PostgreSQL API!");
});

// GET all users
app.get("/header", async (req, res) => {
  try {
    const result = await pool.query("select bill_no,bill_date,bill_type,name,status from sgvschema.billing_header where bill_date >= CURRENT_DATE AT TIME ZONE 'Asia/Calcutta' - INTERVAL '1 MONTHS' order by bill_no desc");
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET details
// app.get("/detail", async (req, res) => {
//   try {
//     const result = await pool.query("select bh.bill_no,bh.bill_date,bh.bill_type,bh.name,bh.phone,bh.secondary_phone,bh.advance,bh.total_paid,bh.status,bd.product_name,bd.product_size,bd.product_height,bd.quantity,bd.product_price,bd.total_price,bd.status from sgvschema.billing_detail bd,sgvschema.billing_header bh where bd.bill_no=bh.bill_no and bh.bill_no = 25 order by bd.product_name");
//     res.json(result.rows);
//   } catch (err) {
//     res.status(500).json({ error: err.message });
//   }
// });

// GET single user by ID
app.get("/detail/:bill_no", async (req, res) => {
  try {
    const { bill_no } = req.params;
    const result = await pool.query("select bh.bill_no,bh.bill_date,bh.bill_type,bh.name,bh.phone,bh.secondary_phone,bh.advance,bh.total_paid ,bh.status as header_status,bd.product_name,bd.product_size,bd.product_height,bd.quantity,bd.product_price,bd.total_price,bd.status as detail_status from sgvschema.billing_detail bd,sgvschema.billing_header bh where bd.bill_no=bh.bill_no and bh.bill_no = $1 order by bd.product_name", [bill_no]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "customer not found" });
    }
    // Build structured response: header once, details array
    const header = {
      bill_no: result.rows[0].bill_no,
      bill_date: result.rows[0].bill_date,
      bill_type: result.rows[0].bill_type,
      name: result.rows[0].name,
      phone: result.rows[0].phone,
      secondary_phone: result.rows[0].secondary_phone,
      advance: result.rows[0].advance,
      total_paid: result.rows[0].total_paid,
      status: result.rows[0].header_status
    };

    const details = result.rows.map(row => ({
      product_name: row.product_name,
      product_size: row.product_size,
      product_height: row.product_height,
      quantity: row.quantity,
      product_price: row.product_price,
      total_price: row.total_price,
      status: row.detail_status
    }));

    res.json({...header, details });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// POST add a new customer bill
app.post("/header", async (req, res) => {
  try {
    const {bill_no,bill_date,bill_type,name,phone,secondary_phone,address,advance,total_paid,status,created_by,updated_by} = req.body;
    const result = await pool.query(
      "INSERT INTO sgvschema.billing_header (bill_no,bill_date,bill_type,name,phone,secondary_phone,address,advance,total_paid,status,created_by,updated_by) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *",
      [bill_no,bill_date,bill_type,name,phone,secondary_phone,address,advance,total_paid,status,created_by,updated_by]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST add a new products to bill
app.post("/detail", async (req, res) => {
  try {
    const {bill_no,product_name,product_size,product_height,product_price,quantity,total_price,purchase_date,return_date,status,created_by,updated_by} = req.body;
    const result = await pool.query(
      "INSERT INTO sgvschema.billing_detail (bill_no,product_name,product_size,product_height,product_price,quantity,total_price,purchase_date,return_date,status,created_by,updated_by) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *",
      [bill_no,product_name,product_size,product_height,product_price,quantity,total_price,purchase_date,return_date,status,created_by,updated_by]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// PUT update an existing bill
app.put("/detail/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email } = req.body;
    const result = await pool.query(
      "UPDATE users SET name = $1, email = $2 WHERE id = $3 RETURNING *",
      [name, email, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE a product
app.delete("/users/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query("DELETE FROM users WHERE id = $1 RETURNING *", [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }
    res.json({ message: "User deleted successfully", deletedUser: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// Start the server
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
