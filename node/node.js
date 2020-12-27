module.exports = function (RED) {
  var request = require("request");

  function OpenWeatherNode(config) {
    RED.nodes.createNode(this, config);

    var node = this;
    if (
      node.hasOwnProperty("credentials") &&
      node.credentials.hasOwnProperty("apikey")
    ) {
      node.apikey = node.credentials.apikey;
    }

    node.language = "en";
    node.lon = config.lon;
    node.lat = config.lat;
    node.cloud_lvl = config.cloud;
    node.battery_lvl = config.battery;
    node.repeat = parseFloat(config.repeat) * 60000;

    node.battery_state_in = null;

    node.cloud_lvl_server = null;
    node.openweathermap_ready = false;

    // node.log(node.apikey);
    // node.log(node.lon);
    // node.log(node.lat);
    // node.log(node.cloud_lvl);
    // node.log(node.battery_lvl);
    // node.log(node.repeat);

    node.outputLogic = function () {
      var msg = { payload: 0 };
      if (node.openweathermap_ready && node.battery_state_in) {
        // B0 > B1
        if (node.battery_state_in > node.battery_lvl) {
          // C0<C1 --> relay ON
          // C0>C1 --> relay OFF
          msg.payload = node.cloud_lvl_server < node.cloud_lvl ? 1 : 2;
          node.send(msg);
        }
      }
      node.status({
        fill: "green",
        shape: "ring",
        text: `Battery ${node.battery_state_in}. Cloud lvl: ${node.cloud_lvl_server}`,
      });
    };

    var timerRepeat = function () {
      var url =
        "http://api.openweathermap.org/data/2.5/weather?lang=" +
        node.language +
        "&lat=" +
        node.lat +
        "&lon=" +
        node.lon +
        "&APPID=" +
        node.apikey;
      request.get(url, function (error, result, data) {
        if (error) {
          node.status({
            fill: "red",
            shape: "ring",
            text: `weather.error.network`,
          });
          node.openweathermap_ready = false;
          return;
        }
        var weather = data;
        var jsun;
        if (weather.indexOf("Invalid API key") > -1) {
          node.status({
            fill: "red",
            shape: "ring",
            text: `weather.error.invalid-key`,
          });
          node.openweathermap_ready = false;
          return;
        }
        try {
          jsun = JSON.parse(weather);
        } catch (e) {
          node.status({
            fill: "red",
            shape: "ring",
            text: `weather.error.invalid-json`,
          });
          node.openweathermap_ready = false;
          return;
        }
        if (jsun) {
          if (jsun.hasOwnProperty("weather") && jsun.hasOwnProperty("main")) {
            // node.log(`Cloud level: ${jsun.clouds.all}`);
            // node.log(`battery state: ${node.battery_state_in }`);
            node.cloud_lvl_server = jsun.clouds.all;
            node.openweathermap_ready = true;
            node.outputLogic();
          }
        }
      });
    };

    timerRepeat();
    this.timerRepeat = setInterval(function () {
      timerRepeat();
    }, node.repeat);

    node.on("input", function (msg) {
      // node.log(JSON.stringify(msg));
      if (msg.hasOwnProperty("batteryState")) {
        node.battery_state_in = parseFloat(msg.batteryState);
      }
      node.outputLogic();
    });

    node.on("close", function (done) {
      if (this.timerRepeat) {
        clearInterval(this.timerRepeat);
      }
      done();
    });
  }

  RED.nodes.registerType("openweather", OpenWeatherNode, {
    credentials: {
      apikey: { type: "password" },
    },
  });
};
