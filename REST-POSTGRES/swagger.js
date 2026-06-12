const swaggerDocument = {
  openapi: "3.0.0",
  info: {
    title: "Marketplace REST API",
    version: "1.0.0",
    description:
      "API REST du marketplace : produits, utilisateurs, commandes, avis et jeux free-to-play (FreeToGame).",
  },
  servers: [
    {
      url: "http://localhost:8800",
      description: "Serveur local",
    },
  ],
  tags: [
    { name: "Products", description: "Catalogue de produits et recherche" },
    { name: "Users", description: "Gestion des utilisateurs" },
    { name: "Orders", description: "Panier et commandes" },
    { name: "Reviews", description: "Avis sur les produits" },
    { name: "F2P Games", description: "Jeux free-to-play via FreeToGame" },
  ],
  components: {
    schemas: {
      ErrorMessage: {
        type: "object",
        properties: {
          message: { type: "string", example: "Not found" },
        },
      },
      ValidationError: {
        type: "object",
        properties: {
          message: { type: "string", example: "Invalid data" },
          errors: {
            type: "array",
            items: { type: "object" },
          },
        },
      },
      User: {
        type: "object",
        properties: {
          id: { type: "integer", example: 1 },
          name: { type: "string", example: "gwen" },
          email: { type: "string", format: "email", example: "gwen@gwen.fr" },
        },
      },
      CreateUser: {
        type: "object",
        required: ["name", "email", "password"],
        properties: {
          name: { type: "string", example: "gwen" },
          email: { type: "string", format: "email", example: "gwen@gwen.fr" },
          password: { type: "string", example: "password" },
        },
      },
      Review: {
        type: "object",
        properties: {
          id: { type: "integer", example: 1 },
          userId: { type: "integer", example: 1 },
          productId: { type: "integer", example: 1 },
          score: { type: "integer", minimum: 1, maximum: 5, example: 4 },
          content: { type: "string", example: "Super jeu" },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
        },
      },
      CreateReview: {
        type: "object",
        required: ["userId", "productId", "score", "content"],
        properties: {
          userId: { type: "integer", example: 1 },
          productId: { type: "integer", example: 1 },
          score: { type: "integer", minimum: 1, maximum: 5, example: 4 },
          content: { type: "string", example: "Super jeu" },
        },
      },
      Product: {
        type: "object",
        properties: {
          id: { type: "integer", example: 1 },
          name: { type: "string", example: "My first game" },
          about: { type: "string", example: "This is an awesome game" },
          price: { type: "number", example: 60 },
          reviewIds: {
            type: "array",
            items: { type: "integer" },
            example: [1],
          },
          totalScore: { type: "number", example: 4 },
        },
      },
      ProductWithReviews: {
        allOf: [
          { $ref: "#/components/schemas/Product" },
          {
            type: "object",
            properties: {
              reviews: {
                type: "array",
                items: { $ref: "#/components/schemas/Review" },
              },
            },
          },
        ],
      },
      Order: {
        type: "object",
        properties: {
          id: { type: "integer", example: 1 },
          userId: { type: "integer", example: 1 },
          user: { $ref: "#/components/schemas/User" },
          productIds: {
            type: "array",
            items: { type: "integer" },
            example: [1],
          },
          products: {
            type: "array",
            items: { $ref: "#/components/schemas/Product" },
          },
          total: { type: "number", example: 72, description: "Prix TTC (TVA 20 %)" },
          payment: { type: "boolean", example: false },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
        },
      },
      CreateOrder: {
        type: "object",
        required: ["userId", "productIds"],
        properties: {
          userId: { type: "integer", example: 1 },
          productIds: {
            type: "array",
            minItems: 1,
            items: { type: "integer" },
            example: [1],
          },
        },
      },
      UpdateOrder: {
        type: "object",
        required: ["userId", "productIds", "payment"],
        properties: {
          userId: { type: "integer", example: 1 },
          productIds: {
            type: "array",
            minItems: 1,
            items: { type: "integer" },
            example: [1],
          },
          payment: { type: "boolean", example: true },
        },
      },
      PatchOrder: {
        type: "object",
        properties: {
          userId: { type: "integer", example: 1 },
          productIds: {
            type: "array",
            minItems: 1,
            items: { type: "integer" },
            example: [1],
          },
          payment: { type: "boolean", example: true },
        },
      },
      F2pGame: {
        type: "object",
        properties: {
          id: { type: "integer", example: 452 },
          title: { type: "string", example: "Call of Duty: Warzone" },
          thumbnail: { type: "string", format: "uri" },
          short_description: { type: "string" },
          genre: { type: "string", example: "Shooter" },
          platform: { type: "string", example: "Windows" },
        },
      },
    },
    responses: {
      BadRequest: {
        description: "Requête invalide (ID ou données incorrects)",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/ErrorMessage" },
          },
        },
      },
      ValidationFailed: {
        description: "Données du corps invalides (validation Zod)",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/ValidationError" },
          },
        },
      },
      NotFound: {
        description: "Ressource introuvable",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/ErrorMessage" },
          },
        },
      },
      Conflict: {
        description: "Conflit (ex. email déjà utilisé)",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/ErrorMessage" },
          },
        },
      },
      InternalError: {
        description: "Erreur interne du serveur",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/ErrorMessage" },
          },
        },
      },
      BadGateway: {
        description: "Échec de l'appel au service externe FreeToGame",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/ErrorMessage" },
          },
        },
      },
    },
  },
  paths: {
    "/products": {
      get: {
        tags: ["Products"],
        summary: "Lister les produits",
        description: "Retourne la liste des produits avec filtres optionnels.",
        parameters: [
          {
            name: "name",
            in: "query",
            description: "Filtrer par titre (contient, insensible à la casse)",
            schema: { type: "string" },
            example: "game",
          },
          {
            name: "about",
            in: "query",
            description: "Filtrer par description (contient, insensible à la casse)",
            schema: { type: "string" },
            example: "fps",
          },
          {
            name: "price",
            in: "query",
            description: "Filtrer par prix maximum (inférieur ou égal)",
            schema: { type: "number" },
            example: 30,
          },
        ],
        responses: {
          200: {
            description: "Liste des produits",
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: { $ref: "#/components/schemas/Product" },
                },
              },
            },
          },
          400: { $ref: "#/components/responses/BadRequest" },
          500: { $ref: "#/components/responses/InternalError" },
        },
      },
    },
    "/products/{id}": {
      get: {
        tags: ["Products"],
        summary: "Obtenir un produit",
        description: "Retourne un produit avec ses avis associés.",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "integer" },
          },
        ],
        responses: {
          200: {
            description: "Produit trouvé",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ProductWithReviews" },
              },
            },
          },
          400: { $ref: "#/components/responses/BadRequest" },
          404: { $ref: "#/components/responses/NotFound" },
          500: { $ref: "#/components/responses/InternalError" },
        },
      },
      delete: {
        tags: ["Products"],
        summary: "Supprimer un produit",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "integer" },
          },
        ],
        responses: {
          200: { description: "Produit supprimé" },
          404: { $ref: "#/components/responses/NotFound" },
        },
      },
    },
    "/users": {
      get: {
        tags: ["Users"],
        summary: "Lister les utilisateurs",
        responses: {
          200: {
            description: "Liste des utilisateurs (sans mot de passe)",
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: { $ref: "#/components/schemas/User" },
                },
              },
            },
          },
          500: { $ref: "#/components/responses/InternalError" },
        },
      },
      post: {
        tags: ["Users"],
        summary: "Créer un utilisateur",
        description: "Le mot de passe est hashé en SHA512 avant stockage.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/CreateUser" },
            },
          },
        },
        responses: {
          201: {
            description: "Utilisateur créé (sans mot de passe)",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/User" },
              },
            },
          },
          400: { $ref: "#/components/responses/ValidationFailed" },
          409: { $ref: "#/components/responses/Conflict" },
          500: { $ref: "#/components/responses/InternalError" },
        },
      },
    },
    "/users/{id}": {
      get: {
        tags: ["Users"],
        summary: "Obtenir un utilisateur",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "integer" },
          },
        ],
        responses: {
          200: {
            description: "Utilisateur trouvé (sans mot de passe)",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/User" },
              },
            },
          },
          404: { $ref: "#/components/responses/NotFound" },
          500: { $ref: "#/components/responses/InternalError" },
        },
      },
      put: {
        tags: ["Users"],
        summary: "Mettre à jour un utilisateur (complet)",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "integer" },
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/CreateUser" },
            },
          },
        },
        responses: {
          200: {
            description: "Utilisateur mis à jour",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/User" },
              },
            },
          },
          400: { $ref: "#/components/responses/ValidationFailed" },
          404: { $ref: "#/components/responses/NotFound" },
          409: { $ref: "#/components/responses/Conflict" },
          500: { $ref: "#/components/responses/InternalError" },
        },
      },
      patch: {
        tags: ["Users"],
        summary: "Mettre à jour un utilisateur (partiel)",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "integer" },
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  email: { type: "string", format: "email" },
                  password: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: "Utilisateur mis à jour",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/User" },
              },
            },
          },
          400: { $ref: "#/components/responses/ValidationFailed" },
          404: { $ref: "#/components/responses/NotFound" },
          409: { $ref: "#/components/responses/Conflict" },
          500: { $ref: "#/components/responses/InternalError" },
        },
      },
      delete: {
        tags: ["Users"],
        summary: "Supprimer un utilisateur",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "integer" },
          },
        ],
        responses: {
          200: {
            description: "Utilisateur supprimé",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/User" },
              },
            },
          },
          400: { $ref: "#/components/responses/BadRequest" },
          404: { $ref: "#/components/responses/NotFound" },
          500: { $ref: "#/components/responses/InternalError" },
        },
      },
    },
    "/orders": {
      get: {
        tags: ["Orders"],
        summary: "Lister les commandes",
        description: "Retourne les commandes avec l'utilisateur et les produits complets.",
        responses: {
          200: {
            description: "Liste des commandes",
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: { $ref: "#/components/schemas/Order" },
                },
              },
            },
          },
          500: { $ref: "#/components/responses/InternalError" },
        },
      },
      post: {
        tags: ["Orders"],
        summary: "Créer une commande",
        description: "Le total est calculé automatiquement (prix × 1,2). payment vaut false par défaut.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/CreateOrder" },
            },
          },
        },
        responses: {
          201: {
            description: "Commande créée",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Order" },
              },
            },
          },
          400: { $ref: "#/components/responses/ValidationFailed" },
          404: { $ref: "#/components/responses/NotFound" },
          500: { $ref: "#/components/responses/InternalError" },
        },
      },
    },
    "/orders/{id}": {
      get: {
        tags: ["Orders"],
        summary: "Obtenir une commande",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "integer" },
          },
        ],
        responses: {
          200: {
            description: "Commande trouvée",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Order" },
              },
            },
          },
          400: { $ref: "#/components/responses/BadRequest" },
          404: { $ref: "#/components/responses/NotFound" },
          500: { $ref: "#/components/responses/InternalError" },
        },
      },
      put: {
        tags: ["Orders"],
        summary: "Mettre à jour une commande (complet)",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "integer" },
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/UpdateOrder" },
            },
          },
        },
        responses: {
          200: {
            description: "Commande mise à jour",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Order" },
              },
            },
          },
          400: { $ref: "#/components/responses/ValidationFailed" },
          404: { $ref: "#/components/responses/NotFound" },
          500: { $ref: "#/components/responses/InternalError" },
        },
      },
      patch: {
        tags: ["Orders"],
        summary: "Mettre à jour une commande (partiel)",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "integer" },
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/PatchOrder" },
            },
          },
        },
        responses: {
          200: {
            description: "Commande mise à jour",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Order" },
              },
            },
          },
          400: { $ref: "#/components/responses/ValidationFailed" },
          404: { $ref: "#/components/responses/NotFound" },
          500: { $ref: "#/components/responses/InternalError" },
        },
      },
      delete: {
        tags: ["Orders"],
        summary: "Supprimer une commande",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "integer" },
          },
        ],
        responses: {
          200: {
            description: "Commande supprimée",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Order" },
              },
            },
          },
          400: { $ref: "#/components/responses/BadRequest" },
          404: { $ref: "#/components/responses/NotFound" },
          500: { $ref: "#/components/responses/InternalError" },
        },
      },
    },
    "/reviews": {
      get: {
        tags: ["Reviews"],
        summary: "Lister les avis",
        responses: {
          200: {
            description: "Liste des avis",
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: { $ref: "#/components/schemas/Review" },
                },
              },
            },
          },
          500: { $ref: "#/components/responses/InternalError" },
        },
      },
      post: {
        tags: ["Reviews"],
        summary: "Créer un avis",
        description: "Met à jour automatiquement reviewIds et totalScore du produit.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/CreateReview" },
            },
          },
        },
        responses: {
          201: {
            description: "Avis créé",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Review" },
              },
            },
          },
          400: { $ref: "#/components/responses/ValidationFailed" },
          404: { $ref: "#/components/responses/NotFound" },
          500: { $ref: "#/components/responses/InternalError" },
        },
      },
    },
    "/reviews/{id}": {
      get: {
        tags: ["Reviews"],
        summary: "Obtenir un avis",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "integer" },
          },
        ],
        responses: {
          200: {
            description: "Avis trouvé",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Review" },
              },
            },
          },
          400: { $ref: "#/components/responses/BadRequest" },
          404: { $ref: "#/components/responses/NotFound" },
          500: { $ref: "#/components/responses/InternalError" },
        },
      },
      put: {
        tags: ["Reviews"],
        summary: "Mettre à jour un avis (complet)",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "integer" },
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/CreateReview" },
            },
          },
        },
        responses: {
          200: {
            description: "Avis mis à jour",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Review" },
              },
            },
          },
          400: { $ref: "#/components/responses/ValidationFailed" },
          404: { $ref: "#/components/responses/NotFound" },
          500: { $ref: "#/components/responses/InternalError" },
        },
      },
      patch: {
        tags: ["Reviews"],
        summary: "Mettre à jour un avis (partiel)",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "integer" },
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  userId: { type: "integer" },
                  productId: { type: "integer" },
                  score: { type: "integer", minimum: 1, maximum: 5 },
                  content: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: "Avis mis à jour",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Review" },
              },
            },
          },
          400: { $ref: "#/components/responses/ValidationFailed" },
          404: { $ref: "#/components/responses/NotFound" },
          500: { $ref: "#/components/responses/InternalError" },
        },
      },
      delete: {
        tags: ["Reviews"],
        summary: "Supprimer un avis",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "integer" },
          },
        ],
        responses: {
          200: {
            description: "Avis supprimé",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Review" },
              },
            },
          },
          400: { $ref: "#/components/responses/BadRequest" },
          404: { $ref: "#/components/responses/NotFound" },
          500: { $ref: "#/components/responses/InternalError" },
        },
      },
    },
    "/f2p-games": {
      get: {
        tags: ["F2P Games"],
        summary: "Lister les jeux free-to-play",
        description: "Proxy vers l'API FreeToGame (https://www.freetogame.com/api/games).",
        responses: {
          200: {
            description: "Liste des jeux F2P",
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: { $ref: "#/components/schemas/F2pGame" },
                },
              },
            },
          },
          502: { $ref: "#/components/responses/BadGateway" },
          500: { $ref: "#/components/responses/InternalError" },
        },
      },
    },
    "/f2p-games/{id}": {
      get: {
        tags: ["F2P Games"],
        summary: "Obtenir un jeu free-to-play",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "integer" },
          },
        ],
        responses: {
          200: {
            description: "Jeu trouvé",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/F2pGame" },
              },
            },
          },
          400: { $ref: "#/components/responses/BadRequest" },
          404: { $ref: "#/components/responses/NotFound" },
          502: { $ref: "#/components/responses/BadGateway" },
          500: { $ref: "#/components/responses/InternalError" },
        },
      },
    },
  },
};

module.exports = swaggerDocument;
