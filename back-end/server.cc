#include <httplib.h>

int main() {
    httplib::Server server;

    server.Post("/simulate", [](const httplib::Request &req, httplib::Response &res) {
        res.set_content("boraaa c******", "text/plain");
    });

    server.listen("127.0.0.1", 8080);
}
