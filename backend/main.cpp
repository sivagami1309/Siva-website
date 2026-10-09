#if defined(SIVA_MART_WITH_DROGON) && __has_include(<drogon/drogon.h>)

#include <drogon/drogon.h>
#include <libpq-fe.h>

#include <cstdlib>
#include <filesystem>
#include <functional>
#include <string>

using namespace drogon;

namespace
{
    // ============================================================
    // PostgreSQL CONNECTION
    // ============================================================
    PGconn *openDatabase()
    {
        const auto getEnv = [](const char *name, const char *fallback)
        {
            const char *value = std::getenv(name);

            if (value != nullptr && *value != '\0')
            {
                return value;
            }

            return fallback;
        };

        return PQsetdbLogin(
            getEnv("PGHOST", "localhost"),
            getEnv("PGPORT", "5432"),
            nullptr,
            nullptr,
            getEnv("PGDATABASE", "siva_mart"),
            getEnv("PGUSER", "postgres"),
            getEnv("PGPASSWORD", "")
        );
    }

    // ============================================================
    // DATABASE ERROR RESPONSE
    // ============================================================
    void sendDatabaseError(
        PGconn *connection,
        const std::function<void(const HttpResponsePtr &)> &callback)
    {
        Json::Value error;

        error["message"] = "Database error";
        error["error"] = PQerrorMessage(connection);

        auto response =
            HttpResponse::newHttpJsonResponse(error);

        response->setStatusCode(k500InternalServerError);

        callback(response);
    }
}


// ================================================================
// MAIN
// ================================================================
int main()
{
    // ============================================================
    // SERVER PORT
    // ============================================================
    const char *portValue = std::getenv("PORT");

    uint16_t port = 8080;

    if (portValue != nullptr && *portValue != '\0')
    {
        try
        {
            port = static_cast<uint16_t>(std::stoi(portValue));
        }
        catch (...)
        {
            port = 8080;
        }
    }


    // ============================================================
    // FRONTEND PATH
    // ============================================================
    const auto frontendPath =
        (std::filesystem::path(__FILE__).parent_path()
         / ".."
         / "frontend")
        .lexically_normal();


    // ============================================================
    // DROGON CONFIGURATION
    // ============================================================
    app().setDocumentRoot(frontendPath.string());

    app().setClientMaxBodySize(
        20 * 1024 * 1024
    );


    // ============================================================
    // HEALTH API
    // ============================================================
    app().registerHandler(
        "/api/health",

        [](const HttpRequestPtr &,
           std::function<void(const HttpResponsePtr &)> &&callback)
        {
            Json::Value response;

            response["status"] = "ok";
            response["backend"] = "drogon";

            callback(
                HttpResponse::newHttpJsonResponse(response)
            );
        },

        {Get}
    );


    // ============================================================
    // GET ALL PRODUCTS
    // ============================================================
    app().registerHandler(
        "/api/products",

        [](const HttpRequestPtr &req,
           std::function<void(const HttpResponsePtr &)> &&callback)
        {
            (void)req;

            PGconn *connection = openDatabase();

            if (connection == nullptr ||
                PQstatus(connection) != CONNECTION_OK)
            {
                if (connection != nullptr)
                {
                    sendDatabaseError(connection, callback);
                    PQfinish(connection);
                }
                else
                {
                    Json::Value error;
                    error["message"] = "Unable to connect to database";

                    auto response =
                        HttpResponse::newHttpJsonResponse(error);

                    response->setStatusCode(
                        k500InternalServerError
                    );

                    callback(response);
                }

                return;
            }


            const char *sql =
                "SELECT "
                "p.id, "
                "p.seller_id, "
                "p.name, "
                "COALESCE(c.name, '') AS category, "
                "COALESCE(p.description, '') AS description, "
                "p.price, "
                "p.stock, "
                "COALESCE(p.image_url, '') AS image_url, "
                "COALESCE(p.brand, '') AS brand "
                "FROM products p "
                "LEFT JOIN categories c "
                "ON c.id = p.category_id "
                "ORDER BY p.id DESC";


            PGresult *result =
                PQexec(connection, sql);


            if (PQresultStatus(result) != PGRES_TUPLES_OK)
            {
                sendDatabaseError(connection, callback);

                PQclear(result);
                PQfinish(connection);

                return;
            }


            Json::Value products(
                Json::arrayValue
            );


            for (int row = 0;
                 row < PQntuples(result);
                 ++row)
            {
                Json::Value product;


                product["id"] =
                    std::stoi(
                        PQgetvalue(result, row, 0)
                    );


                product["seller_id"] =
                    std::stoi(
                        PQgetvalue(result, row, 1)
                    );


                product["name"] =
                    PQgetvalue(result, row, 2);


                product["category"] =
                    PQgetvalue(result, row, 3);


                product["description"] =
                    PQgetvalue(result, row, 4);


                product["price"] =
                    std::stod(
                        PQgetvalue(result, row, 5)
                    );


                product["stock"] =
                    std::stoi(
                        PQgetvalue(result, row, 6)
                    );


                product["image_url"] =
                    PQgetvalue(result, row, 7);


                product["brand"] =
                    PQgetvalue(result, row, 8);


                products.append(product);
            }


            PQclear(result);
            PQfinish(connection);


            callback(
                HttpResponse::newHttpJsonResponse(products)
            );
        },

        {Get}
    );


    // ============================================================
    // POST /api/products
    //
    // SELLER ADD PRODUCT
    // ============================================================
    app().registerHandler(
        "/api/products",

        [](const HttpRequestPtr &req,
           std::function<void(const HttpResponsePtr &)> &&callback)
        {
            try
            {
                // ------------------------------------------------
                // GET JSON
                // ------------------------------------------------
                auto json = req->getJsonObject();


                if (!json)
                {
                    Json::Value error;

                    error["message"] =
                        "Invalid JSON request";


                    auto response =
                        HttpResponse::newHttpJsonResponse(error);


                    response->setStatusCode(
                        k400BadRequest
                    );


                    callback(response);

                    return;
                }


                // ------------------------------------------------
                // USER ID
                // ------------------------------------------------
                const std::string userIdHeader =
                    req->getHeader("x-user-id");


                // ------------------------------------------------
                // USER ROLE
                // ------------------------------------------------
                const std::string userRole =
                    req->getHeader("x-user-role");


                // ------------------------------------------------
                // AUTHENTICATION CHECK
                // ------------------------------------------------
                if (userIdHeader.empty())
                {
                    Json::Value error;

                    error["message"] =
                        "Authentication required";


                    auto response =
                        HttpResponse::newHttpJsonResponse(error);


                    response->setStatusCode(
                        k401Unauthorized
                    );


                    callback(response);

                    return;
                }


                // ------------------------------------------------
                // SELLER ROLE CHECK
                // ------------------------------------------------
                if (userRole != "seller")
                {
                    Json::Value error;

                    error["message"] =
                        "Only sellers can add products";


                    auto response =
                        HttpResponse::newHttpJsonResponse(error);


                    response->setStatusCode(
                        k403Forbidden
                    );


                    callback(response);

                    return;
                }


                // ------------------------------------------------
                // CONVERT USER ID
                // ------------------------------------------------
                int sellerId;

                try
                {
                    sellerId =
                        std::stoi(userIdHeader);
                }
                catch (...)
                {
                    Json::Value error;

                    error["message"] =
                        "Invalid user ID";


                    auto response =
                        HttpResponse::newHttpJsonResponse(error);


                    response->setStatusCode(
                        k400BadRequest
                    );


                    callback(response);

                    return;
                }


                // ------------------------------------------------
                // REQUIRED FIELDS
                // ------------------------------------------------
                if (!json->isMember("name") ||
                    !json->isMember("price") ||
                    !json->isMember("stock"))
                {
                    Json::Value error;

                    error["message"] =
                        "name, price and stock are required";


                    auto response =
                        HttpResponse::newHttpJsonResponse(error);


                    response->setStatusCode(
                        k400BadRequest
                    );


                    callback(response);

                    return;
                }


                // ------------------------------------------------
                // READ PRODUCT DATA
                // ------------------------------------------------
                const std::string name =
                    (*json)["name"].asString();


                const std::string category =
                    json->get(
                        "category",
                        ""
                    ).asString();


                const std::string description =
                    json->get(
                        "description",
                        ""
                    ).asString();


                const double price =
                    (*json)["price"].asDouble();


                const int stock =
                    (*json)["stock"].asInt();


                const std::string imageUrl =
                    json->get(
                        "image_url",
                        ""
                    ).asString();


                const std::string brand =
                    json->get(
                        "brand",
                        ""
                    ).asString();


                // ------------------------------------------------
                // BASIC VALIDATION
                // ------------------------------------------------
                if (name.empty())
                {
                    Json::Value error;

                    error["message"] =
                        "Product name cannot be empty";


                    auto response =
                        HttpResponse::newHttpJsonResponse(error);


                    response->setStatusCode(
                        k400BadRequest
                    );


                    callback(response);

                    return;
                }


                if (price < 0)
                {
                    Json::Value error;

                    error["message"] =
                        "Price cannot be negative";


                    auto response =
                        HttpResponse::newHttpJsonResponse(error);


                    response->setStatusCode(
                        k400BadRequest
                    );


                    callback(response);

                    return;
                }


                if (stock < 0)
                {
                    Json::Value error;

                    error["message"] =
                        "Stock cannot be negative";


                    auto response =
                        HttpResponse::newHttpJsonResponse(error);


                    response->setStatusCode(
                        k400BadRequest
                    );


                    callback(response);

                    return;
                }


                // ------------------------------------------------
                // DATABASE CONNECTION
                // ------------------------------------------------
                PGconn *connection =
                    openDatabase();


                if (connection == nullptr ||
                    PQstatus(connection) != CONNECTION_OK)
                {
                    if (connection != nullptr)
                    {
                        sendDatabaseError(
                            connection,
                            callback
                        );

                        PQfinish(connection);
                    }
                    else
                    {
                        Json::Value error;

                        error["message"] =
                            "Unable to connect to database";


                        auto response =
                            HttpResponse::newHttpJsonResponse(error);


                        response->setStatusCode(
                            k500InternalServerError
                        );


                        callback(response);
                    }

                    return;
                }


                // ------------------------------------------------
                // CONVERT VALUES TO STRING
                // ------------------------------------------------
                const std::string sellerIdValue =
                    std::to_string(sellerId);


                const std::string priceValue =
                    std::to_string(price);


                const std::string stockValue =
                    std::to_string(stock);


                // ------------------------------------------------
                // SQL PARAMETERS
                // ------------------------------------------------
                const char *parameters[] =
                {
                    sellerIdValue.c_str(),
                    name.c_str(),
                    description.c_str(),
                    priceValue.c_str(),
                    stockValue.c_str(),
                    imageUrl.c_str(),
                    brand.c_str(),
                    category.c_str()
                };


                // ------------------------------------------------
                // INSERT PRODUCT
                // ------------------------------------------------
                const char *sql =
                    "INSERT INTO products "
                    "("
                    "seller_id, "
                    "category_id, "
                    "name, "
                    "description, "
                    "price, "
                    "stock, "
                    "image_url, "
                    "brand"
                    ") "
                    "SELECT "
                    "$1, "
                    "c.id, "
                    "$2, "
                    "$3, "
                    "$4, "
                    "$5, "
                    "$6, "
                    "$7 "
                    "FROM users u "
                    "LEFT JOIN categories c "
                    "ON LOWER(c.name) = LOWER($8) "
                    "WHERE u.id = $1 "
                    "AND u.role = 'seller' "
                    "RETURNING id";


                PGresult *result =
                    PQexecParams(
                        connection,
                        sql,
                        8,
                        nullptr,
                        parameters,
                        nullptr,
                        nullptr,
                        0
                    );


                // ------------------------------------------------
                // SQL ERROR
                // ------------------------------------------------
                if (PQresultStatus(result) != PGRES_TUPLES_OK)
                {
                    sendDatabaseError(
                        connection,
                        callback
                    );


                    PQclear(result);
                    PQfinish(connection);

                    return;
                }


                // ------------------------------------------------
                // USER NOT FOUND
                // ------------------------------------------------
                if (PQntuples(result) == 0)
                {
                    Json::Value error;

                    error["message"] =
                        "User not found or seller role is required";


                    auto response =
                        HttpResponse::newHttpJsonResponse(error);


                    response->setStatusCode(
                        k403Forbidden
                    );


                    PQclear(result);
                    PQfinish(connection);


                    callback(response);

                    return;
                }


                // ------------------------------------------------
                // SUCCESS
                // ------------------------------------------------
                Json::Value response;

                response["message"] =
                    "Product added successfully";


                response["id"] =
                    std::stoi(
                        PQgetvalue(
                            result,
                            0,
                            0
                        )
                    );


                PQclear(result);
                PQfinish(connection);


                callback(
                    HttpResponse::newHttpJsonResponse(response)
                );
            }
            catch (const std::exception &e)
            {
                Json::Value error;

                error["message"] =
                    "Invalid product data";

                error["error"] =
                    e.what();


                auto response =
                    HttpResponse::newHttpJsonResponse(error);


                response->setStatusCode(
                    k400BadRequest
                );


                callback(response);
            }
        },

        {Post}
    );


    // ============================================================
    // START SERVER
    // ============================================================
    app().addListener(
        "0.0.0.0",
        port
    );


    LOG_INFO
        << "SIVA_MART Drogon backend running at http://localhost:"
        << port;


    app().run();

    return 0;
}


// ================================================================
// DROGON NOT AVAILABLE
// ================================================================
#else

#include <iostream>

int main()
{
    std::cout
        << "Drogon is not installed or SIVA_MART_WITH_DROGON "
           "is not enabled.\n"
        << "Please check your CMake configuration.\n";

    return 1;
}

#endif