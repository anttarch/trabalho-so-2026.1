#include <httplib.h>
#include <nlohmann/json.hpp>

#include <string>

#include "internals/core.h"
#include "internals/payload.h"

using json = nlohmann::json;

int main() {
  httplib::Server server;

  server.Post(
      "/simulate", [](const httplib::Request &req, httplib::Response &res) {
        try {
          auto in = json::parse(req.body);
          payload p = payload_from_json(in);

          Simulator sim;
          sim.run(p);

          ordered_json out = sim.process_result();

          res.status = 201;
          res.set_content(out.dump(), "application/json");
        } catch (const std::exception &e) {
          res.status = 400;
          res.set_content("{\"error\":\"invalid json\"}", "application/json");
        }
      });

  server.listen("127.0.0.1", 8080);
}
