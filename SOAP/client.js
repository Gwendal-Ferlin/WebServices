const soap = require("soap");

soap.createClient("http://localhost:8000/products?wsdl", {}, function (err, client) {
  if (err) {
    console.error("Error creating SOAP client:", err);
    return;
  }
  // Make a SOAP request
  client.CreateProduct({ name: "My product", about: "This is an awesome product", price: 100 }, function (err, result) {
    if (err) {
      console.error(
        "Error making SOAP request:",
        err.response.status,
        err.response.statusText,
        err.body
      );
      return;
    }
    console.log("Result:", result);
  });

  client.GetProducts({}, function (err, result) {
    if (err) {
      console.error(
        "Error making SOAP request:",
        err.response.status,
        err.response.statusText,
        err.body
      );
      return;
    }
    console.log("Result:", result);
  });

  client.PatchProduct({ id: "5", name: "Updated product", price: 150 }, function (err, result) {
    if (err) {
      console.error(
        "Error making SOAP request:",
        err.response?.status,
        err.response?.statusText,
        err.body
      );
      return;
    }
    console.log("PatchProduct Result:", result);
  });

  client.DeleteProduct({ id: "6" }, function (err, result) {
    if (err) {
      console.error(
        "Error making SOAP request:",
        err.response?.status,
        err.response?.statusText,
        err.body
      );
      return;
    }
    console.log("DeleteProduct Result:", result);
  });
});
