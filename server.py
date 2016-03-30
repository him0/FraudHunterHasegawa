import logging
import tornado.httpserver
import tornado.ioloop
import tornado.websocket
import tornado.options
import tornado.web
import tornado.escape
import os

from tornado import gen, web
from tornado.options import define
from Furikome import Furikome

define("port", default=8880, help="run on the given port", type=int)

class MainHandler(tornado.web.RequestHandler):
    def get(self):
        self.render("index.html")

class TextSocketHandler(tornado.websocket.WebSocketHandler):
    waiters = set()
    Store_Number=101;
    Store_y=0;

    cache = []
    cache_size = 200
    furikome = Furikome()

    def open(self):
        print("WebSocket opened\n")
        TextSocketHandler.waiters.add(self)

    def on_close(self):
        TextSocketHandler.waiters.remove(self)
        print ("Closed!!")

    def send_updates(self, message):
        logging.info("sending message to %r:%r", self, message)
        json_message = tornado.escape.json_encode(message)
        try:
            self.write_message(json_message)
        except:
            logging.error("Error sending message", exc_info=True)

    # @web.asynchronous
    # @gen.engine
    def on_message(self, messages):
        logging.info("got messages %r", messages)
        received = tornado.escape.json_decode(messages)

        # result = yield gen.Task(self.furikome.classify_text, received["message"])

        result = self.furikome.classify_text(received["message"])
        result["status"] = received["status"]
        self.send_updates(result)

def main():
    io=tornado.ioloop.IOLoop.instance()
    tornado.options.parse_command_line()
    application = tornado.web.Application([
        (r"/", MainHandler),
        (r"/websocket", TextSocketHandler)
        ],
        template_path=os.path.join(os.getcwd(),  "templates"),
        static_path=os.path.join(os.getcwd(),  "static"),
        debug=True,
    )
    if os.path.isdir(os.path.join(os.path.dirname(__file__), "ssl")):
        http_server = tornado.httpserver.HTTPServer(application, ssl_options={
        "keyfile": os.path.join(os.path.dirname(__file__), "ssl/serverkey.pem"),
        "certfile": os.path.join(os.path.dirname(__file__), "ssl/servercrt.pem"),
    })
    else:
        http_server = tornado.httpserver.HTTPServer(application)
    port = int(os.environ.get("PORT", 8880))
    http_server.listen(port)
    io.start()


if __name__ == "__main__":
    main()