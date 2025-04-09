# **📦 Distributed Microservices Architecture Report**

This report outlines the architecture and implementation of a microservices-based system using Docker Compose. It covers key aspects including distributed transactions (2PC), MongoDB replica sets, sharding, event choreography with RabbitMQ, and caching using Redis.

---

## **🔐 1\. Two-Phase Commit (2PC)**

### **✅ Goal**

Ensure atomic consistency between services like OrderService, PaymentService, and ProductService when processing an order.

### **🛠️ Implementation**

* **Phase 1 (Prepare)**: OrderService sends `prepare` requests to involved services.  
* **Phase 2 (Commit/Rollback)**:  
  * If all services respond `OK`, a `commit` is issued.  
  * If any service fails or times out, a `rollback` is issued.

### **🧪 Example**

\[OrderService\] Starting 2PC for order 1001  
\[ProductService\] Preparing inventory lock → OK  
\[PaymentService\] Preparing payment hold → OK  
\[OrderService\] All services OK → COMMIT  
\[ProductService\] Committing inventory  
\[PaymentService\] Committing payment  
---

## **🧬 2\. MongoDB Replica Set**

### **✅ Goal**

Ensure high availability and automatic failover for MongoDB by setting up a replica set.

### **🛠️ Configuration**

* Replica Set: `rs0`  
* Members:  
  * `mongo1`: Primary  
  * `mongo2`: Secondary  
  * `mongo3`: Secondary

### **📸 Evidence**

* Screenshot of `rs.status()` shows primary and secondaries.  
* Replica failover tested by stopping `mongo1`, observing promotion of a secondary.

---

## **🧹 3\. MongoDB Sharding**

### **✅ Goal**

Improve scalability and distribute product data across shards.

### **🛠️ Setup**

* Shards: `shard1`, `shard2`  
* Config Server: `configsvr`  
* Router: `mongos`  
* Collection: `productService.products`  
* Shard Key: `{ category: 1 }`

**Setup Commands**

sh.enableSharding("productService")  
sh.shardCollection("productService.products", { category: 1 })

### **📸 Evidence**

* `sh.status()` shows two shards.  
* Query logs confirm routing based on different categories.

---

## **📣 4\. Event Choreography with RabbitMQ**

### **✅ Goal**

Ensure services communicate asynchronously using events rather than direct calls.

### **🛠️ Architecture**

* Services: Order, Payment, Product  
* Broker: RabbitMQ  
* Events:  
  * `OrderCreated` → triggers inventory check and payment  
  * `PaymentConfirmed` → triggers shipment

### **🧪 Sample Flow**

\[OrderService\] Emitted OrderCreated  
\[InventoryService\] Reserved items  
\[PaymentService\] Processed payment  
\[PaymentService\] Emitted PaymentConfirmed  
\[OrderService\] Marked order as confirmed  
---

## **💡 5\. Caching with Redis**

### **✅ Goal**

Improve performance by caching frequent queries (e.g., product lookups).

### **🛠️ Integration**

* Cache Layer: Redis  
* Use Case: ProductService caches product details by ID  
* TTL: 3600 seconds

### **📸 Evidence**

* Logs showing cache hits/misses:

\[ProductService\] Cache MISS for product \#101  
\[ProductService\] Cache HIT for product \#101

* Redis keys and TTLs:

127.0.0.1:6379\> keys \*  
"product:1"  
127.0.0.1:6379\> ttl product:1
(integer) 3439
---

## **📄 Summary**

This architecture demonstrates a robust distributed system using containerized microservices. It ensures consistency (2PC), availability (replica sets), scalability (sharding), decoupled communication (event choreography), and performance (caching). Each part was tested and verified with logs and screenshots as required.
