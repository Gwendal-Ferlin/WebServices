const { z } = require("zod");

const IdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

const ProductSearchQuerySchema = z.object({
  name: z.string().trim().min(1).optional(),
  about: z.string().trim().min(1).optional(),
  price: z.coerce.number().positive().optional(),
});

const CreateUserSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(1),
});

const UpdateUserSchema = CreateUserSchema;

const PatchUserSchema = CreateUserSchema.partial().refine(
  (data) => Object.keys(data).length > 0,
  { message: "At least one field is required" }
);

const CreateProductSchema = z.object({
  name: z.string().min(1),
  about: z.string().min(1),
  price: z.coerce.number().positive(),
});

const UpdateProductSchema = CreateProductSchema;

const PatchProductSchema = CreateProductSchema.partial().refine(
  (data) => Object.keys(data).length > 0,
  { message: "At least one field is required" }
);

const CreateOrderSchema = z.object({
  userId: z.coerce.number().int().positive(),
  productIds: z.array(z.coerce.number().int().positive()).min(1),
});

const UpdateOrderSchema = CreateOrderSchema.extend({
  payment: z.boolean(),
});

const PatchOrderSchema = z
  .object({
    userId: z.coerce.number().int().positive().optional(),
    productIds: z.array(z.coerce.number().int().positive()).min(1).optional(),
    payment: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field is required",
  });

const CreateReviewSchema = z.object({
  userId: z.coerce.number().int().positive(),
  productId: z.coerce.number().int().positive(),
  score: z.coerce.number().int().min(1).max(5),
  content: z.string().min(1),
});

const UpdateReviewSchema = CreateReviewSchema;

const PatchReviewSchema = CreateReviewSchema.partial().refine(
  (data) => Object.keys(data).length > 0,
  { message: "At least one field is required" }
);

function validate(schema, data) {
  return schema.safeParse(data);
}

function validationErrorResponse(error) {
  return {
    message: "Invalid data",
    errors: error.issues,
  };
}

module.exports = {
  IdParamSchema,
  ProductSearchQuerySchema,
  CreateUserSchema,
  UpdateUserSchema,
  PatchUserSchema,
  CreateProductSchema,
  UpdateProductSchema,
  PatchProductSchema,
  CreateOrderSchema,
  UpdateOrderSchema,
  PatchOrderSchema,
  CreateReviewSchema,
  UpdateReviewSchema,
  PatchReviewSchema,
  validate,
  validationErrorResponse,
};
