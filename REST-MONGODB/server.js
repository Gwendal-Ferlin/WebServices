const express = require("express");
const { createServer } = require("node:http");
const { join } = require("node:path");
const { Server } = require("socket.io");
const { z } = require("zod");
const { MongoClient, ObjectId } = require("mongodb");

const app = express();
const server = createServer(app);
const io = new Server(server);
const port = 8801;
const client = new MongoClient("mongodb://127.0.0.1:27017");
let db;

app.use(express.json());
app.use(express.static(join(__dirname, "public")));

const ObjectIdSchema = z
  .string()
  .refine((id) => ObjectId.isValid(id), { message: "Invalid ObjectId" });

const ProductSchema = z.object({
  _id: ObjectIdSchema,
  name: z.string().min(1),
  about: z.string().min(1),
  price: z.number().positive(),
  categoryIds: z.array(ObjectIdSchema),
});
const CreateProductSchema = ProductSchema.omit({ _id: true });
const UpdateProductSchema = CreateProductSchema;
const PatchProductSchema = CreateProductSchema.partial();

const CategorySchema = z.object({
  _id: ObjectIdSchema,
  name: z.string().min(1),
});
const CreateCategorySchema = CategorySchema.omit({ _id: true });

const IdParamSchema = z.object({ id: ObjectIdSchema });

function validationErrorResponse(error) {
  return { message: "Validation error", errors: error.flatten() };
}

function parseObjectId(id) {
  return new ObjectId(id);
}

function emitProductEvent(action, product) {
  io.emit("products", { action, product });
}

async function categoriesExist(categoryIds) {
  if (categoryIds.length === 0) return true;
  const count = await db
    .collection("categories")
    .countDocuments({ _id: { $in: categoryIds } });
  return count === categoryIds.length;
}

async function findProductWithCategories(match) {
  const results = await db
    .collection("products")
    .aggregate([
      { $match: match },
      {
        $lookup: {
          from: "categories",
          localField: "categoryIds",
          foreignField: "_id",
          as: "categories",
        },
      },
    ])
    .toArray();

  return results[0] ?? null;
}

async function findAllProductsWithCategories() {
  return db
    .collection("products")
    .aggregate([
      { $match: {} },
      {
        $lookup: {
          from: "categories",
          localField: "categoryIds",
          foreignField: "_id",
          as: "categories",
        },
      },
    ])
    .toArray();
}

app.get("/products", async (req, res) => {
  try {
    const result = await findAllProductsWithCategories();
    res.send(result);
  } catch (error) {
    console.error("Error in GET /products:", error);
    res.status(500).send({ message: "Internal server error" });
  }
});

app.get("/products/:id", async (req, res) => {
  try {
    const paramValidation = IdParamSchema.safeParse(req.params);
    if (!paramValidation.success) {
      return res.status(400).send(validationErrorResponse(paramValidation.error));
    }

    const product = await findProductWithCategories({
      _id: parseObjectId(paramValidation.data.id),
    });

    if (!product) {
      return res.status(404).send({ message: "Not found" });
    }

    res.send(product);
  } catch (error) {
    console.error("Error in GET /products/:id:", error);
    res.status(500).send({ message: "Internal server error" });
  }
});

app.post("/products", async (req, res) => {
  try {
    const result = CreateProductSchema.safeParse(req.body);

    if (!result.success) {
      return res.status(400).send(validationErrorResponse(result.error));
    }

    const { name, about, price, categoryIds } = result.data;
    const categoryObjectIds = categoryIds.map((id) => parseObjectId(id));

    if (!(await categoriesExist(categoryObjectIds))) {
      return res.status(404).send({ message: "One or more categories not found" });
    }

    const ack = await db.collection("products").insertOne({
      name,
      about,
      price,
      categoryIds: categoryObjectIds,
    });

    const product = await findProductWithCategories({ _id: ack.insertedId });
    emitProductEvent("created", product);
    res.status(201).send(product);
  } catch (error) {
    console.error("Error in POST /products:", error);
    res.status(500).send({ message: "Internal server error" });
  }
});

app.put("/products/:id", async (req, res) => {
  try {
    const paramValidation = IdParamSchema.safeParse(req.params);
    if (!paramValidation.success) {
      return res.status(400).send(validationErrorResponse(paramValidation.error));
    }

    const bodyValidation = UpdateProductSchema.safeParse(req.body);
    if (!bodyValidation.success) {
      return res.status(400).send(validationErrorResponse(bodyValidation.error));
    }

    const productId = parseObjectId(paramValidation.data.id);
    const { name, about, price, categoryIds } = bodyValidation.data;
    const categoryObjectIds = categoryIds.map((id) => parseObjectId(id));

    if (!(await categoriesExist(categoryObjectIds))) {
      return res.status(404).send({ message: "One or more categories not found" });
    }

    const updateResult = await db.collection("products").findOneAndUpdate(
      { _id: productId },
      { $set: { name, about, price, categoryIds: categoryObjectIds } },
      { returnDocument: "after" }
    );

    if (!updateResult) {
      return res.status(404).send({ message: "Not found" });
    }

    const product = await findProductWithCategories({ _id: productId });
    emitProductEvent("updated", product);
    res.send(product);
  } catch (error) {
    console.error("Error in PUT /products/:id:", error);
    res.status(500).send({ message: "Internal server error" });
  }
});

app.patch("/products/:id", async (req, res) => {
  try {
    const paramValidation = IdParamSchema.safeParse(req.params);
    if (!paramValidation.success) {
      return res.status(400).send(validationErrorResponse(paramValidation.error));
    }

    const bodyValidation = PatchProductSchema.safeParse(req.body);
    if (!bodyValidation.success) {
      return res.status(400).send(validationErrorResponse(bodyValidation.error));
    }

    if (Object.keys(bodyValidation.data).length === 0) {
      return res.status(400).send({ message: "No fields to update" });
    }

    const productId = parseObjectId(paramValidation.data.id);
    const updateFields = { ...bodyValidation.data };

    if (updateFields.categoryIds) {
      updateFields.categoryIds = updateFields.categoryIds.map((id) =>
        parseObjectId(id)
      );

      if (!(await categoriesExist(updateFields.categoryIds))) {
        return res.status(404).send({ message: "One or more categories not found" });
      }
    }

    const updateResult = await db.collection("products").findOneAndUpdate(
      { _id: productId },
      { $set: updateFields },
      { returnDocument: "after" }
    );

    if (!updateResult) {
      return res.status(404).send({ message: "Not found" });
    }

    const product = await findProductWithCategories({ _id: productId });
    emitProductEvent("updated", product);
    res.send(product);
  } catch (error) {
    console.error("Error in PATCH /products/:id:", error);
    res.status(500).send({ message: "Internal server error" });
  }
});

app.delete("/products/:id", async (req, res) => {
  try {
    const paramValidation = IdParamSchema.safeParse(req.params);
    if (!paramValidation.success) {
      return res.status(400).send(validationErrorResponse(paramValidation.error));
    }

    const productId = parseObjectId(paramValidation.data.id);
    const existing = await findProductWithCategories({ _id: productId });

    if (!existing) {
      return res.status(404).send({ message: "Not found" });
    }

    await db.collection("products").deleteOne({ _id: productId });
    emitProductEvent("deleted", { _id: productId });
    res.send(existing);
  } catch (error) {
    console.error("Error in DELETE /products/:id:", error);
    res.status(500).send({ message: "Internal server error" });
  }
});

app.post("/categories", async (req, res) => {
  try {
    const result = CreateCategorySchema.safeParse(req.body);

    if (!result.success) {
      return res.status(400).send(validationErrorResponse(result.error));
    }

    const { name } = result.data;
    const ack = await db.collection("categories").insertOne({ name });

    res.status(201).send({ _id: ack.insertedId, name });
  } catch (error) {
    console.error("Error in POST /categories:", error);
    res.status(500).send({ message: "Internal server error" });
  }
});

client.connect().then(() => {
  db = client.db("myDB");
  server.listen(port, () => {
    console.log(`Listening on http://localhost:${port}`);
  });
});
