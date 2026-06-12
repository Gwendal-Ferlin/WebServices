const express = require("express");
const { z } = require("zod");
const { MongoClient, ObjectId } = require("mongodb");

const app = express();
const port = 8802;
const client = new MongoClient("mongodb://127.0.0.1:27017");
let db;

app.use(express.json());

const ObjectIdSchema = z
  .string()
  .refine((id) => ObjectId.isValid(id), { message: "Invalid ObjectId" });

const IdParamSchema = z.object({ id: ObjectIdSchema });
const GoalIdParamSchema = z.object({ goalId: ObjectIdSchema });

const AnalyticsBaseSchema = z.object({
  source: z.string().min(1),
  url: z.string().min(1),
  visitor: z.string().min(1),
  createdAt: z.coerce.date().optional(),
  meta: z.record(z.string(), z.unknown()).default({}),
});

const ViewSchema = AnalyticsBaseSchema.extend({ _id: ObjectIdSchema });
const ActionSchema = AnalyticsBaseSchema.extend({
  _id: ObjectIdSchema,
  action: z.string().min(1),
});
const GoalSchema = AnalyticsBaseSchema.extend({
  _id: ObjectIdSchema,
  goal: z.string().min(1),
});

const CreateViewSchema = ViewSchema.omit({ _id: true });
const CreateActionSchema = ActionSchema.omit({ _id: true });
const CreateGoalSchema = GoalSchema.omit({ _id: true });

function validationErrorResponse(error) {
  return { message: "Validation error", errors: error.flatten() };
}

function parseObjectId(id) {
  return new ObjectId(id);
}

function withCreatedAt(data) {
  return {
    ...data,
    createdAt: data.createdAt ?? new Date(),
  };
}

function createResourceRoutes(collectionName, CreateSchema) {
  app.get(`/${collectionName}`, async (req, res) => {
    try {
      const items = await db.collection(collectionName).find({}).toArray();
      res.send(items);
    } catch (error) {
      console.error(`Error in GET /${collectionName}:`, error);
      res.status(500).send({ message: "Internal server error" });
    }
  });

  app.get(`/${collectionName}/:id`, async (req, res) => {
    try {
      const paramValidation = IdParamSchema.safeParse(req.params);
      if (!paramValidation.success) {
        return res.status(400).send(validationErrorResponse(paramValidation.error));
      }

      const item = await db.collection(collectionName).findOne({
        _id: parseObjectId(paramValidation.data.id),
      });

      if (!item) {
        return res.status(404).send({ message: "Not found" });
      }

      res.send(item);
    } catch (error) {
      console.error(`Error in GET /${collectionName}/:id:`, error);
      res.status(500).send({ message: "Internal server error" });
    }
  });

  app.post(`/${collectionName}`, async (req, res) => {
    try {
      const result = CreateSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).send(validationErrorResponse(result.error));
      }

      const ack = await db
        .collection(collectionName)
        .insertOne(withCreatedAt(result.data));

      const item = await db.collection(collectionName).findOne({
        _id: ack.insertedId,
      });

      res.status(201).send(item);
    } catch (error) {
      console.error(`Error in POST /${collectionName}:`, error);
      res.status(500).send({ message: "Internal server error" });
    }
  });

  app.delete(`/${collectionName}/:id`, async (req, res) => {
    try {
      const paramValidation = IdParamSchema.safeParse(req.params);
      if (!paramValidation.success) {
        return res.status(400).send(validationErrorResponse(paramValidation.error));
      }

      const deleted = await db.collection(collectionName).findOneAndDelete({
        _id: parseObjectId(paramValidation.data.id),
      });

      if (!deleted) {
        return res.status(404).send({ message: "Not found" });
      }

      res.send(deleted);
    } catch (error) {
      console.error(`Error in DELETE /${collectionName}/:id:`, error);
      res.status(500).send({ message: "Internal server error" });
    }
  });
}

createResourceRoutes("views", CreateViewSchema);
createResourceRoutes("actions", CreateActionSchema);
createResourceRoutes("goals", CreateGoalSchema);

app.get("/goals/:goalId/details", async (req, res) => {
  try {
    const paramValidation = GoalIdParamSchema.safeParse(req.params);
    if (!paramValidation.success) {
      return res.status(400).send(validationErrorResponse(paramValidation.error));
    }

    const goalId = parseObjectId(paramValidation.data.goalId);
    const results = await db
      .collection("goals")
      .aggregate([
        { $match: { _id: goalId } },
        {
          $lookup: {
            from: "views",
            localField: "visitor",
            foreignField: "visitor",
            as: "views",
          },
        },
        {
          $lookup: {
            from: "actions",
            localField: "visitor",
            foreignField: "visitor",
            as: "actions",
          },
        },
      ])
      .toArray();

    if (results.length === 0) {
      return res.status(404).send({ message: "Not found" });
    }

    res.send(results[0]);
  } catch (error) {
    console.error("Error in GET /goals/:goalId/details:", error);
    res.status(500).send({ message: "Internal server error" });
  }
});

client.connect().then(() => {
  db = client.db("analyticsDB");
  app.listen(port, () => {
    console.log(`Listening on http://localhost:${port}`);
  });
});
