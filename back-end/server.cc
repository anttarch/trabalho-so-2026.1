#include <httplib.h>
#include <nlohmann/json.hpp>

#include <string>

#include "internals/payload.h"

using json = nlohmann::json;

int main() {
  httplib::Server server;

  server.Post(
      "/simulate", [](const httplib::Request &req, httplib::Response &res) {
        try {
          auto in = json::parse(req.body);
          payload p = payload_from_json(in);

          res.status = 201;
          res.set_content(p.process_list[0].name, "application/json");
        } catch (const std::exception &e) {
          res.status = 400;
          res.set_content("{\"error\":\"invalid json\"}", "application/json");
        }
      });

  server.listen("127.0.0.1", 8080);
}
