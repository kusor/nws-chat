var sys    = require('sys'),
    path   = require('path'),
    exec   = require('child_process').exec,
    fu     = require("./fu"),
    ws     = require("websocket-server"),
    server = ws.createServer({
      debug: true
    }),
    uptime;

// require.paths.unshift(path.join(path.dirname(__dirname), 'node-websocket-server/lib'));

// Static stuff:
fu.listen(80, '0.0.0.0');
fu.get("/", fu.staticHandler(path.join(__dirname,"public/index.html")));
fu.get("/stylesheets/main.css", fu.staticHandler(path.join(__dirname,"public/stylesheets/main.css")));
fu.get("/javascripts/websocket.js", fu.staticHandler(path.join(__dirname,"public/javascripts/websocket.js")));
fu.get("/favicon.ico", fu.staticHandler(path.join(__dirname,"public/favicon.ico")));
fu.get("/images/logo.png", fu.staticHandler(path.join(__dirname,"public/images/logo.png")));
fu.get("/images/tab.gif", fu.staticHandler(path.join(__dirname,"public/images/tab.gif")));


server.addListener("listening", function () {
  sys.log("Listening for connections.");
  var mem = process.memoryUsage(),
      etime = "00:00\n"; 
  setInterval(function() {
    mem = process.memoryUsage();
    uptime = exec('ps -o etime= -p ' + process.pid, 
      function (error, stdout, stderr) {
        etime = stdout;
        if (error !== null) {
          sys.log('exec error: ' + error);
        }
        if (stderr) {
          sys.log('stderr: ' + stderr);
        };
    });

    server.broadcast(JSON.stringify({
      'stats': {
        'rss': (mem.rss/(1024*1024)).toFixed(2),
        'uptime': etime.replace(/\n$/, "")
      }
    }));
  }, 30*1000);
});

server.addListener("connection", function (connection) {
  var username = "user_" + connection.id;
  connection.storage.set("username", username);
  connection.send(JSON.stringify({
    'info': "Welcome. Type '/help' for more information."
  }));
  connection.broadcast(JSON.stringify({
    'info' : "User '" + username + "' connected!"
  }));
  
  var roaster = JSON.stringify({
    'roaster': server.manager.map(function (client) {
      return client.storage.get("username");
    })
  });
  server.broadcast(roaster);
  
  connection.addListener("message", function (msg) {
    if (msg[0] == "/") {
      if ( (matches = msg.match(/^\/nick (\w+)$/i)) && matches[1] ) {
        username = connection.storage.get("username");
        connection.storage.set("username", matches[1]);
        connection.send(JSON.stringify({
          'info': "Successfully changed nick to '" + matches[1] + "'"
        }));
        
        connection.broadcast(JSON.stringify({
          'info' : "User '" + username + "' is now known as '" + matches[1] + "'"
        }));
        
        var roaster = JSON.stringify({
          'roaster': server.manager.map(function (client) {
            return client.storage.get("username");
          })
        });

        server.broadcast(roaster);
      } else if(/^\/help/.test(msg)){
          connection.send(JSON.stringify({'info': [
            "Type '/nick USERNAME' to change your username.",
            "Type '/quit' to exit."
          ]}));
      }
    } else {
      var m = JSON.stringify({
        'message': "<" + connection.storage.get("username") + ">: " + msg
      });
      server.broadcast(m);
    };
  });

});

server.addListener("close", function (connection) {
  server.broadcast(JSON.stringify({
    'info':"User '" + connection.storage.get("username") + "' left the channel."
  }));

  var roaster = JSON.stringify({
    'roaster': server.manager.map(function (client) {
      return client.storage.get("username");
    })
  });

  server.broadcast(roaster);
});

server.listen(8080);
