# SENG468-Activities

Navigate to app/ directory and run 
`docker-compose up --build`

Curl commands to test

curl --location 'http://localhost:8080/api/cart/add-to-cart' \
--header 'Content-Type: application/json' \
--data '{
    "itemId": "item1",
    "quantity": 1
}'