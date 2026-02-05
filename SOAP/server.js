const soap = require("soap");
const fs = require("node:fs");
const http = require("http");
const postgres = require("postgres");
 
const sql = postgres({ 
  host: "localhost",
  port: 5433,
  db: "mydb", 
  user: "user", 
  password: "password" 
});


const service = {
  ProductsService: {
    ProductsPort: {
        CreateProduct: async function ({ name, about, price }, callback) {
            if (!name || !about || !price) {
              throw {
                Fault: {
                  Code: {
                    Value: "soap:Sender",
                    Subcode: { value: "rpc:BadArguments" },
                  },
                  Reason: { Text: "Processing Error" },
                  statusCode: 400,
                },
              };
            }
     
            const product = await sql`
              INSERT INTO products (name, about, price)
              VALUES (${name}, ${about}, ${price})
              RETURNING *
              `;
     
            callback(product[0]);
          },
          GetProducts: async function (args, callback) {
            const products = await sql`
              SELECT * FROM products
              `;
     
            callback(products);
          },
          DeleteProduct: async function ({ id }, callback) {
            if (!id) {
              throw {
                Fault: {
                  Code: {
                    Value: "soap:Sender",
                    Subcode: { value: "rpc:BadArguments" },
                  },
                  Reason: { Text: "Product ID is required" },
                  statusCode: 400,
                },
              };
            }
     
            const deleted = await sql`
              DELETE FROM products
              WHERE id = ${id}
              RETURNING *
              `;
     
            if (deleted.length === 0) {
              throw {
                Fault: {
                  Code: {
                    Value: "soap:Sender",
                    Subcode: { value: "rpc:NotFound" },
                  },
                  Reason: { Text: "Product not found" },
                  statusCode: 404,
                },
              };
            }
     
            callback({
              success: true,
              message: "Product deleted successfully"
            });
          },
          PatchProduct: async function ({ id, name, about, price }, callback) {
            if (!id) {
              throw {
                Fault: {
                  Code: {
                    Value: "soap:Sender",
                    Subcode: { value: "rpc:BadArguments" },
                  },
                  Reason: { Text: "Product ID is required" },
                  statusCode: 400,
                },
              };
            }
     
            const existing = await sql`
              SELECT * FROM products WHERE id = ${id}
              `;
     
            if (existing.length === 0) {
              throw {
                Fault: {
                  Code: {
                    Value: "soap:Sender",
                    Subcode: { value: "rpc:NotFound" },
                  },
                  Reason: { Text: "Product not found" },
                  statusCode: 404,
                },
              };
            }
     
            if (name === undefined && about === undefined && price === undefined) {
              throw {
                Fault: {
                  Code: {
                    Value: "soap:Sender",
                    Subcode: { value: "rpc:BadArguments" },
                  },
                  Reason: { Text: "At least one field (name, about, or price) must be provided" },
                  statusCode: 400,
                },
              };
            }
     
            const current = existing[0];
            
            const updateName = name !== undefined && name !== null ? name : current.name;
            const updateAbout = about !== undefined && about !== null ? about : current.about;
            const updatePrice = price !== undefined && price !== null ? price : current.price;
            
            const updated = await sql`
              UPDATE products
              SET name = ${updateName}, about = ${updateAbout}, price = ${updatePrice}
              WHERE id = ${id}
              RETURNING *
            `;
     
            callback(updated[0]);
          },
    },
  },
};

const server = http.createServer(function (request, response) {
    response.end("404: Not Found: " + request.url);
  });
  
  server.listen(8000);
  
  const xml = fs.readFileSync("productsService.wsdl", "utf8");
  soap.listen(server, "/products", service, xml, function () {
    console.log("SOAP server running at http://localhost:8000/products?wsdl");
  });