const express = require("express");
const app = express();
const port = 8800;
const postgres = require("postgres");
const z = require("zod");
const crypto = require("crypto");


const sql = postgres({
    host: "localhost",
    port: 5433,
    db: "mydb",
    user: "user",
    password: "password"
});

app.use(express.json());

function hashPassword(password) {
  return crypto.createHash("sha512").update(password).digest("hex");
}

function removePassword(user) {
  if (!user) return user;
  const { password, ...userWithoutPassword } = user;
  return userWithoutPassword;
}

function removePasswordFromArray(users) {
  return users.map(removePassword);
}


const UserSchema = z.object({
    id: z.string(),
    name: z.string(),
    email: z.string().email(),
    password: z.string(),
  });
  const CreateUserSchema = UserSchema.omit({ id: true });
  const UpdateUserSchema = CreateUserSchema;
  const PatchUserSchema = CreateUserSchema.partial();

  const ProductSchema = z.object({
    id: z.string(),
    name: z.string(),
    about: z.string(),
    price: z.number().positive(),
  });
  const CreateProductSchema = ProductSchema.omit({ id: true });
   
  app.get("/products", async (req, res) => {
    const products = await sql`
      SELECT * FROM products
      `;
  
    res.send(products);
  });
  
  app.get("/products/:id", async (req, res) => {
    const product = await sql`
      SELECT * FROM products WHERE id=${req.params.id}
      `;
  
    if (product.length > 0) {
      res.send(product[0]);
    } else {
      res.status(404).send({ message: "Not found" });
    }
  });

  app.delete("/products/:id", async (req, res) => {
    const product = await sql`
      DELETE FROM products
      WHERE id=${req.params.id}
      RETURNING *
      `;
  
    if (product.length > 0) {
      res.send(product[0]);
    } else {
      res.status(404).send({ message: "Not found" });
    }
  });

app.get("/users", async (req, res) => {
  try {
    const users = await sql`
      SELECT * FROM users
    `;
    res.send(removePasswordFromArray(users));
  } catch (error) {
    res.status(500).send({ message: "Internal server error" });
  }
});

app.get("/users/:id", async (req, res) => {
  try {
    const users = await sql`
      SELECT * FROM users WHERE id=${req.params.id}
    `;
  
    if (users.length > 0) {
      res.send(removePassword(users[0]));
    } else {
      res.status(404).send({ message: "Not found" });
    }
  } catch (error) {
    res.status(500).send({ message: "Internal server error" });
  }
});

app.post("/users", async (req, res) => {
  try {
    const validation = CreateUserSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).send({ message: "Invalid data", errors: validation.error.errors });
    }

    const { name, email, password } = validation.data;
    const hashedPassword = hashPassword(password);

    const users = await sql`
      INSERT INTO users (name, email, password)
      VALUES (${name}, ${email}, ${hashedPassword})
      RETURNING *
    `;

    res.status(201).send(removePassword(users[0]));
  } catch (error) {
    if (error.code === "23505") {
      res.status(409).send({ message: "Email already exists" });
    } else {
      res.status(500).send({ message: "Internal server error" });
    }
  }
});

app.put("/users/:id", async (req, res) => {
  try {
    const validation = UpdateUserSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).send({ message: "Invalid data", errors: validation.error.errors });
    }

    const existing = await sql`
      SELECT * FROM users WHERE id=${req.params.id}
    `;

    if (existing.length === 0) {
      return res.status(404).send({ message: "User not found" });
    }

    const { name, email, password } = validation.data;
    const hashedPassword = hashPassword(password);

    const users = await sql`
      UPDATE users
      SET name = ${name}, email = ${email}, password = ${hashedPassword}
      WHERE id = ${req.params.id}
      RETURNING *
    `;

    res.send(removePassword(users[0]));
  } catch (error) {
    if (error.code === "23505") {
      res.status(409).send({ message: "Email already exists" });
    } else {
      res.status(500).send({ message: "Internal server error" });
    }
  }
});

app.patch("/users/:id", async (req, res) => {
  try {
    const validation = PatchUserSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).send({ message: "Invalid data", errors: validation.error.errors });
    }

    const existing = await sql`
      SELECT * FROM users WHERE id=${req.params.id}
    `;

    if (existing.length === 0) {
      return res.status(404).send({ message: "User not found" });
    }

    const current = existing[0];
    const { name, email, password } = validation.data;

    const updateName = name !== undefined ? name : current.name;
    const updateEmail = email !== undefined ? email : current.email;
    const updatePassword = password !== undefined ? hashPassword(password) : current.password;

    const users = await sql`
      UPDATE users
      SET name = ${updateName}, email = ${updateEmail}, password = ${updatePassword}
      WHERE id = ${req.params.id}
      RETURNING *
    `;

    res.send(removePassword(users[0]));
  } catch (error) {
    if (error.code === "23505") {
      res.status(409).send({ message: "Email already exists" });
    } else {
      res.status(500).send({ message: "Internal server error" });
    }
  }
});

app.delete("/users/:id", async (req, res) => {
  try {
    const users = await sql`
      DELETE FROM users
      WHERE id=${req.params.id}
      RETURNING *
    `;
  
    if (users.length > 0) {
      res.send(removePassword(users[0]));
    } else {
      res.status(404).send({ message: "Not found" });
    }
  } catch (error) {
    res.status(500).send({ message: "Internal server error" });
  }
});

app.get("/", (req, res) => {
    res.send("Hello World!");
});

app.listen(port, () => {
    console.log(`Listening on http://localhost:${port}`);
});