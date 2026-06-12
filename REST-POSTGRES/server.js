const express = require("express");
const app = express();
const port = 8800;
const postgres = require("postgres");
const crypto = require("crypto");
const swaggerUi = require("swagger-ui-express");
const swaggerDocument = require("./swagger");
const {
  IdParamSchema,
  ProductSearchQuerySchema,
  CreateUserSchema,
  UpdateUserSchema,
  PatchUserSchema,
  CreateOrderSchema,
  UpdateOrderSchema,
  PatchOrderSchema,
  CreateReviewSchema,
  UpdateReviewSchema,
  PatchReviewSchema,
  validate,
  validationErrorResponse,
} = require("./schemas");


const sql = postgres({
    host: "localhost",
    port: 5434,
    db: "mydb",
    user: "user",
    password: "password"
});

app.use(express.json());
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));
app.get("/api-docs.json", (req, res) => {
  res.send(swaggerDocument);
});

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


  function formatReview(review) {
    return {
      id: review.id,
      userId: review.user_id,
      productId: review.product_id,
      score: review.score,
      content: review.content,
      createdAt: review.created_at,
      updatedAt: review.updated_at,
    };
  }

  function formatProduct(product, reviews = null) {
    const formatted = {
      id: product.id,
      name: product.name,
      about: product.about,
      price: Number(product.price),
      reviewIds: product.review_ids || [],
      totalScore: Number(product.total_score || 0),
    };

    if (reviews !== null) {
      formatted.reviews = reviews.map(formatReview);
    }

    return formatted;
  }

  async function updateProductReviewStats(productId) {
    const reviews = await sql`
      SELECT id, score FROM reviews WHERE product_id = ${productId} ORDER BY id
    `;
    const reviewIds = reviews.map((review) => review.id);
    const totalScore = reviews.reduce((acc, review) => acc + review.score, 0);

    await sql`
      UPDATE products
      SET review_ids = ${reviewIds},
          total_score = ${totalScore}
      WHERE id = ${productId}
    `;
  }

  async function calculateTotal(productIds) {
    const products = await sql`
      SELECT price FROM products WHERE id IN ${sql(productIds)}
    `;

    if (products.length !== productIds.length) {
      return null;
    }

    const sum = products.reduce((acc, product) => acc + Number(product.price), 0);
    return sum * 1.2;
  }

  async function getOrderProductIds(orderId) {
    const rows = await sql`
      SELECT product_id FROM order_products WHERE order_id = ${orderId}
    `;
    return rows.map((row) => row.product_id);
  }

  function formatOrder(order, user, products, productIds) {
    return {
      id: order.id,
      userId: order.user_id,
      user: user ? removePassword(user) : null,
      productIds,
      products,
      total: Number(order.total),
      payment: order.payment,
      createdAt: order.created_at,
      updatedAt: order.updated_at,
    };
  }

  async function getOrderDetails(orderId) {
    const orders = await sql`
      SELECT * FROM orders WHERE id = ${orderId}
    `;

    if (orders.length === 0) {
      return null;
    }

    const order = orders[0];
    const users = await sql`
      SELECT * FROM users WHERE id = ${order.user_id}
    `;
    const productIds = await getOrderProductIds(orderId);
    const products = productIds.length > 0
      ? await sql`SELECT * FROM products WHERE id IN ${sql(productIds)}`
      : [];

    return formatOrder(order, users[0], products, productIds);
  }

  async function userExists(userId) {
    const users = await sql`SELECT id FROM users WHERE id = ${userId}`;
    return users.length > 0;
  }

  async function productExists(productId) {
    const products = await sql`SELECT id FROM products WHERE id = ${productId}`;
    return products.length > 0;
  }
   
  app.get("/products", async (req, res) => {
    try {
      const queryValidation = validate(ProductSearchQuerySchema, req.query);
      if (!queryValidation.success) {
        return res.status(400).send(validationErrorResponse(queryValidation.error));
      }

      const { name, about, price } = queryValidation.data;

      const products = await sql`
        SELECT * FROM products
        WHERE 1=1
        ${name ? sql`AND name ILIKE ${"%" + name + "%"}` : sql``}
        ${about ? sql`AND about ILIKE ${"%" + about + "%"}` : sql``}
        ${price !== undefined ? sql`AND price <= ${price}` : sql``}
      `;

      res.send(products.map((product) => formatProduct(product)));
    } catch (error) {
      console.error("Error in GET /products:", error);
      res.status(500).send({ message: "Internal server error" });
    }
  });
  
  app.get("/products/:id", async (req, res) => {
    try {
      const paramValidation = validate(IdParamSchema, req.params);
      if (!paramValidation.success) {
        return res.status(400).send(validationErrorResponse(paramValidation.error));
      }

      const { id: productId } = paramValidation.data;

      const products = await sql`
        SELECT * FROM products WHERE id = ${productId}
      `;

      if (products.length === 0) {
        return res.status(404).send({ message: "Not found" });
      }

      const reviews = await sql`
        SELECT * FROM reviews WHERE product_id = ${productId} ORDER BY id
      `;

      res.send(formatProduct(products[0], reviews));
    } catch (error) {
      console.error("Error in GET /products/:id:", error);
      res.status(500).send({ message: "Internal server error" });
    }
  });

  app.delete("/products/:id", async (req, res) => {
    try {
      const paramValidation = validate(IdParamSchema, req.params);
      if (!paramValidation.success) {
        return res.status(400).send(validationErrorResponse(paramValidation.error));
      }

      const { id: productId } = paramValidation.data;

      const product = await sql`
        DELETE FROM products
        WHERE id = ${productId}
        RETURNING *
      `;

      if (product.length > 0) {
        res.send(formatProduct(product[0]));
      } else {
        res.status(404).send({ message: "Not found" });
      }
    } catch (error) {
      console.error("Error in DELETE /products/:id:", error);
      res.status(500).send({ message: "Internal server error" });
    }
  });

app.get("/users", async (req, res) => {
  try {
    const users = await sql`
      SELECT * FROM users
    `;
    res.send(removePasswordFromArray(users));
  } catch (error) {
    console.error("Error in GET /users:", error);
    res.status(500).send({ message: "Internal server error" });
  }
});

app.get("/users/:id", async (req, res) => {
  try {
    const paramValidation = validate(IdParamSchema, req.params);
    if (!paramValidation.success) {
      return res.status(400).send(validationErrorResponse(paramValidation.error));
    }

    const { id: userId } = paramValidation.data;

    const users = await sql`
      SELECT * FROM users WHERE id = ${userId}
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
    const validation = validate(CreateUserSchema, req.body);
    if (!validation.success) {
      return res.status(400).send(validationErrorResponse(validation.error));
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
    const paramValidation = validate(IdParamSchema, req.params);
    if (!paramValidation.success) {
      return res.status(400).send(validationErrorResponse(paramValidation.error));
    }

    const { id: userId } = paramValidation.data;

    const validation = validate(UpdateUserSchema, req.body);
    if (!validation.success) {
      return res.status(400).send(validationErrorResponse(validation.error));
    }

    const existing = await sql`
      SELECT * FROM users WHERE id=${userId}
    `;

    if (existing.length === 0) {
      return res.status(404).send({ message: "User not found" });
    }

    const { name, email, password } = validation.data;
    const hashedPassword = hashPassword(password);

    const users = await sql`
      UPDATE users
      SET name = ${name}, email = ${email}, password = ${hashedPassword}
      WHERE id = ${userId}
      RETURNING *
    `;

    res.send(removePassword(users[0]));
  } catch (error) {
    console.error("Error in PUT /users/:id:", error);
    if (error.code === "23505") {
      res.status(409).send({ message: "Email already exists" });
    } else {
      res.status(500).send({ message: "Internal server error" });
    }
  }
});

app.patch("/users/:id", async (req, res) => {
  try {
    const paramValidation = validate(IdParamSchema, req.params);
    if (!paramValidation.success) {
      return res.status(400).send(validationErrorResponse(paramValidation.error));
    }

    const { id: userId } = paramValidation.data;

    const validation = validate(PatchUserSchema, req.body);
    if (!validation.success) {
      return res.status(400).send(validationErrorResponse(validation.error));
    }

    const existing = await sql`
      SELECT * FROM users WHERE id=${userId}
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
      WHERE id = ${userId}
      RETURNING *
    `;

    res.send(removePassword(users[0]));
  } catch (error) {
    console.error("Error in PATCH /users/:id:", error);
    if (error.code === "23505") {
      res.status(409).send({ message: "Email already exists" });
    } else {
      res.status(500).send({ message: "Internal server error" });
    }
  }
});

app.delete("/users/:id", async (req, res) => {
  try {
    const paramValidation = validate(IdParamSchema, req.params);
    if (!paramValidation.success) {
      return res.status(400).send(validationErrorResponse(paramValidation.error));
    }

    const { id: userId } = paramValidation.data;

    const users = await sql`
      DELETE FROM users
      WHERE id=${userId}
      RETURNING *
    `;
  
    if (users.length > 0) {
      res.send(removePassword(users[0]));
    } else {
      res.status(404).send({ message: "Not found" });
    }
  } catch (error) {
    console.error("Error in DELETE /users/:id:", error);
    res.status(500).send({ message: "Internal server error" });
  }
});

app.get("/orders", async (req, res) => {
  try {
    const orders = await sql`SELECT id FROM orders ORDER BY id`;
    const detailedOrders = await Promise.all(
      orders.map((order) => getOrderDetails(order.id))
    );
    res.send(detailedOrders);
  } catch (error) {
    console.error("Error in GET /orders:", error);
    res.status(500).send({ message: "Internal server error" });
  }
});

app.get("/orders/:id", async (req, res) => {
  try {
    const paramValidation = validate(IdParamSchema, req.params);
    if (!paramValidation.success) {
      return res.status(400).send(validationErrorResponse(paramValidation.error));
    }

    const { id: orderId } = paramValidation.data;

    const order = await getOrderDetails(orderId);

    if (!order) {
      return res.status(404).send({ message: "Not found" });
    }

    res.send(order);
  } catch (error) {
    console.error("Error in GET /orders/:id:", error);
    res.status(500).send({ message: "Internal server error" });
  }
});

app.post("/orders", async (req, res) => {
  try {
    const validation = validate(CreateOrderSchema, req.body);
    if (!validation.success) {
      return res.status(400).send(validationErrorResponse(validation.error));
    }

    const { userId, productIds } = validation.data;

    if (!(await userExists(userId))) {
      return res.status(404).send({ message: "User not found" });
    }

    const total = await calculateTotal(productIds);
    if (total === null) {
      return res.status(404).send({ message: "One or more products not found" });
    }

    const order = await sql.begin(async (tx) => {
      const [createdOrder] = await tx`
        INSERT INTO orders (user_id, total, payment)
        VALUES (${userId}, ${total}, false)
        RETURNING *
      `;

      for (const productId of productIds) {
        await tx`
          INSERT INTO order_products (order_id, product_id)
          VALUES (${createdOrder.id}, ${productId})
        `;
      }

      return createdOrder;
    });

    const detailedOrder = await getOrderDetails(order.id);
    res.status(201).send(detailedOrder);
  } catch (error) {
    console.error("Error in POST /orders:", error);
    res.status(500).send({ message: "Internal server error" });
  }
});

app.put("/orders/:id", async (req, res) => {
  try {
    const paramValidation = validate(IdParamSchema, req.params);
    if (!paramValidation.success) {
      return res.status(400).send(validationErrorResponse(paramValidation.error));
    }

    const { id: orderId } = paramValidation.data;

    const validation = validate(UpdateOrderSchema, req.body);
    if (!validation.success) {
      return res.status(400).send(validationErrorResponse(validation.error));
    }

    const existing = await sql`SELECT * FROM orders WHERE id = ${orderId}`;
    if (existing.length === 0) {
      return res.status(404).send({ message: "Order not found" });
    }

    const { userId, productIds, payment } = validation.data;

    if (!(await userExists(userId))) {
      return res.status(404).send({ message: "User not found" });
    }

    const total = await calculateTotal(productIds);
    if (total === null) {
      return res.status(404).send({ message: "One or more products not found" });
    }

    await sql.begin(async (tx) => {
      await tx`
        UPDATE orders
        SET user_id = ${userId},
            total = ${total},
            payment = ${payment},
            updated_at = NOW()
        WHERE id = ${orderId}
      `;

      await tx`DELETE FROM order_products WHERE order_id = ${orderId}`;

      for (const productId of productIds) {
        await tx`
          INSERT INTO order_products (order_id, product_id)
          VALUES (${orderId}, ${productId})
        `;
      }
    });

    const detailedOrder = await getOrderDetails(orderId);
    res.send(detailedOrder);
  } catch (error) {
    console.error("Error in PUT /orders/:id:", error);
    res.status(500).send({ message: "Internal server error" });
  }
});

app.patch("/orders/:id", async (req, res) => {
  try {
    const paramValidation = validate(IdParamSchema, req.params);
    if (!paramValidation.success) {
      return res.status(400).send(validationErrorResponse(paramValidation.error));
    }

    const { id: orderId } = paramValidation.data;

    const validation = validate(PatchOrderSchema, req.body);
    if (!validation.success) {
      return res.status(400).send(validationErrorResponse(validation.error));
    }

    const existing = await sql`SELECT * FROM orders WHERE id = ${orderId}`;
    if (existing.length === 0) {
      return res.status(404).send({ message: "Order not found" });
    }

    const current = existing[0];
    const { userId, productIds, payment } = validation.data;

    const updateUserId = userId !== undefined ? userId : current.user_id;
    const updateProductIds = productIds !== undefined
      ? productIds
      : await getOrderProductIds(orderId);
    const updatePayment = payment !== undefined ? payment : current.payment;

    if (userId !== undefined && !(await userExists(userId))) {
      return res.status(404).send({ message: "User not found" });
    }

    let updateTotal = Number(current.total);
    if (productIds !== undefined) {
      const total = await calculateTotal(productIds);
      if (total === null) {
        return res.status(404).send({ message: "One or more products not found" });
      }
      updateTotal = total;
    }

    await sql.begin(async (tx) => {
      await tx`
        UPDATE orders
        SET user_id = ${updateUserId},
            total = ${updateTotal},
            payment = ${updatePayment},
            updated_at = NOW()
        WHERE id = ${orderId}
      `;

      if (productIds !== undefined) {
        await tx`DELETE FROM order_products WHERE order_id = ${orderId}`;

        for (const productId of productIds) {
          await tx`
            INSERT INTO order_products (order_id, product_id)
            VALUES (${orderId}, ${productId})
          `;
        }
      }
    });

    const detailedOrder = await getOrderDetails(orderId);
    res.send(detailedOrder);
  } catch (error) {
    console.error("Error in PATCH /orders/:id:", error);
    res.status(500).send({ message: "Internal server error" });
  }
});

app.delete("/orders/:id", async (req, res) => {
  try {
    const paramValidation = validate(IdParamSchema, req.params);
    if (!paramValidation.success) {
      return res.status(400).send(validationErrorResponse(paramValidation.error));
    }

    const { id: orderId } = paramValidation.data;

    const detailedOrder = await getOrderDetails(orderId);
    if (!detailedOrder) {
      return res.status(404).send({ message: "Not found" });
    }

    await sql`DELETE FROM orders WHERE id = ${orderId}`;
    res.send(detailedOrder);
  } catch (error) {
    console.error("Error in DELETE /orders/:id:", error);
    res.status(500).send({ message: "Internal server error" });
  }
});

app.get("/reviews", async (req, res) => {
  try {
    const reviews = await sql`SELECT * FROM reviews ORDER BY id`;
    res.send(reviews.map(formatReview));
  } catch (error) {
    console.error("Error in GET /reviews:", error);
    res.status(500).send({ message: "Internal server error" });
  }
});

app.get("/reviews/:id", async (req, res) => {
  try {
    const paramValidation = validate(IdParamSchema, req.params);
    if (!paramValidation.success) {
      return res.status(400).send(validationErrorResponse(paramValidation.error));
    }

    const { id: reviewId } = paramValidation.data;

    const reviews = await sql`SELECT * FROM reviews WHERE id = ${reviewId}`;

    if (reviews.length === 0) {
      return res.status(404).send({ message: "Not found" });
    }

    res.send(formatReview(reviews[0]));
  } catch (error) {
    console.error("Error in GET /reviews/:id:", error);
    res.status(500).send({ message: "Internal server error" });
  }
});

app.post("/reviews", async (req, res) => {
  try {
    const validation = validate(CreateReviewSchema, req.body);
    if (!validation.success) {
      return res.status(400).send(validationErrorResponse(validation.error));
    }

    const { userId, productId, score, content } = validation.data;

    if (!(await userExists(userId))) {
      return res.status(404).send({ message: "User not found" });
    }

    if (!(await productExists(productId))) {
      return res.status(404).send({ message: "Product not found" });
    }

    const [review] = await sql`
      INSERT INTO reviews (user_id, product_id, score, content)
      VALUES (${userId}, ${productId}, ${score}, ${content})
      RETURNING *
    `;

    await updateProductReviewStats(productId);

    res.status(201).send(formatReview(review));
  } catch (error) {
    console.error("Error in POST /reviews:", error);
    res.status(500).send({ message: "Internal server error" });
  }
});

app.put("/reviews/:id", async (req, res) => {
  try {
    const paramValidation = validate(IdParamSchema, req.params);
    if (!paramValidation.success) {
      return res.status(400).send(validationErrorResponse(paramValidation.error));
    }

    const { id: reviewId } = paramValidation.data;

    const validation = validate(UpdateReviewSchema, req.body);
    if (!validation.success) {
      return res.status(400).send(validationErrorResponse(validation.error));
    }

    const existing = await sql`SELECT * FROM reviews WHERE id = ${reviewId}`;
    if (existing.length === 0) {
      return res.status(404).send({ message: "Review not found" });
    }

    const { userId, productId, score, content } = validation.data;
    const previousProductId = existing[0].product_id;

    if (!(await userExists(userId))) {
      return res.status(404).send({ message: "User not found" });
    }

    if (!(await productExists(productId))) {
      return res.status(404).send({ message: "Product not found" });
    }

    const [review] = await sql`
      UPDATE reviews
      SET user_id = ${userId},
          product_id = ${productId},
          score = ${score},
          content = ${content},
          updated_at = NOW()
      WHERE id = ${reviewId}
      RETURNING *
    `;

    await updateProductReviewStats(previousProductId);
    if (productId !== previousProductId) {
      await updateProductReviewStats(productId);
    }

    res.send(formatReview(review));
  } catch (error) {
    console.error("Error in PUT /reviews/:id:", error);
    res.status(500).send({ message: "Internal server error" });
  }
});

app.patch("/reviews/:id", async (req, res) => {
  try {
    const paramValidation = validate(IdParamSchema, req.params);
    if (!paramValidation.success) {
      return res.status(400).send(validationErrorResponse(paramValidation.error));
    }

    const { id: reviewId } = paramValidation.data;

    const validation = validate(PatchReviewSchema, req.body);
    if (!validation.success) {
      return res.status(400).send(validationErrorResponse(validation.error));
    }

    const existing = await sql`SELECT * FROM reviews WHERE id = ${reviewId}`;
    if (existing.length === 0) {
      return res.status(404).send({ message: "Review not found" });
    }

    const current = existing[0];
    const { userId, productId, score, content } = validation.data;
    const previousProductId = current.product_id;

    const updateUserId = userId !== undefined ? userId : current.user_id;
    const updateProductId = productId !== undefined ? productId : current.product_id;
    const updateScore = score !== undefined ? score : current.score;
    const updateContent = content !== undefined ? content : current.content;

    if (userId !== undefined && !(await userExists(userId))) {
      return res.status(404).send({ message: "User not found" });
    }

    if (productId !== undefined && !(await productExists(productId))) {
      return res.status(404).send({ message: "Product not found" });
    }

    const [review] = await sql`
      UPDATE reviews
      SET user_id = ${updateUserId},
          product_id = ${updateProductId},
          score = ${updateScore},
          content = ${updateContent},
          updated_at = NOW()
      WHERE id = ${reviewId}
      RETURNING *
    `;

    await updateProductReviewStats(previousProductId);
    if (updateProductId !== previousProductId) {
      await updateProductReviewStats(updateProductId);
    }

    res.send(formatReview(review));
  } catch (error) {
    console.error("Error in PATCH /reviews/:id:", error);
    res.status(500).send({ message: "Internal server error" });
  }
});

app.delete("/reviews/:id", async (req, res) => {
  try {
    const paramValidation = validate(IdParamSchema, req.params);
    if (!paramValidation.success) {
      return res.status(400).send(validationErrorResponse(paramValidation.error));
    }

    const { id: reviewId } = paramValidation.data;

    const existing = await sql`SELECT * FROM reviews WHERE id = ${reviewId}`;
    if (existing.length === 0) {
      return res.status(404).send({ message: "Not found" });
    }

    const productId = existing[0].product_id;
    await sql`DELETE FROM reviews WHERE id = ${reviewId}`;
    await updateProductReviewStats(productId);

    res.send(formatReview(existing[0]));
  } catch (error) {
    console.error("Error in DELETE /reviews/:id:", error);
    res.status(500).send({ message: "Internal server error" });
  }
});

const F2P_GAMES_API = "https://www.freetogame.com/api";

app.get("/f2p-games", async (req, res) => {
  try {
    const response = await fetch(`${F2P_GAMES_API}/games`);

    if (!response.ok) {
      return res.status(502).send({ message: "Failed to fetch games from FreeToGame" });
    }

    const games = await response.json();
    res.send(games);
  } catch (error) {
    console.error("Error in GET /f2p-games:", error);
    res.status(500).send({ message: "Internal server error" });
  }
});

app.get("/f2p-games/:id", async (req, res) => {
  try {
    const paramValidation = validate(IdParamSchema, req.params);
    if (!paramValidation.success) {
      return res.status(400).send(validationErrorResponse(paramValidation.error));
    }

    const { id: gameId } = paramValidation.data;

    const response = await fetch(`${F2P_GAMES_API}/game?id=${gameId}`);

    if (!response.ok) {
      return res.status(502).send({ message: "Failed to fetch game from FreeToGame" });
    }

    const game = await response.json();

    if (game.status === 0) {
      return res.status(404).send({ message: "Not found" });
    }

    res.send(game);
  } catch (error) {
    console.error("Error in GET /f2p-games/:id:", error);
    res.status(500).send({ message: "Internal server error" });
  }
});

app.get("/", (req, res) => {
    res.send("Hello World!");
});

app.listen(port, () => {
    console.log(`Listening on http://localhost:${port}`);
    console.log(`Swagger docs on http://localhost:${port}/api-docs`);
});