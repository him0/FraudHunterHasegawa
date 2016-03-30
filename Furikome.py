import os
from watson_developer_cloud import NaturalLanguageClassifierV1


class Furikome:
    def __init__(self):

        self.natural_language_classifier = NaturalLanguageClassifierV1(
            username=os.environ["USER_ID"],
            password=os.environ["USER_PASS"]
        )

        self.classified_texts = []  # textとそのクラスのハッシュは格納
        self.dubious_border = 0.6  # 割合は調整が必要かも
        self.minimal_talk_count = 5

    # 発言を記録する
    # 戻り値は、発言自体のクラスと蓄積した結果を含むディクショナリ
    def recode(self, text):
        classified_text = self.classify_text(text)
        self.classified_texts.append(classified_text)
        talk_dubious = False  # 発言数が少ない間は、詐欺じゃない判定
        if len(self.classified_texts) > self.minimal_talk_count:
            talk_dubious = self.judge_texts()
        return {
            "text": classified_text["text"],
            "class": classified_text["class"],
            "talk_dubious": talk_dubious
        }

    def judge_texts(self):
        dubious_text_count = 0
        for ct in self.classified_texts:
            if ct["class"] == "dubious":
                dubious_text_count += 1
        ratio = float(dubious_text_count) / len(self.classified_texts)
        if ratio > self.dubious_border:
            return True
        else:
            return False

    def classify_text(self, text):
        result = self.request(text)
        text_class = result["top_class"]
        return ({
            "text": text,
            "class": text_class
        })

    def request(self, content):
        classes = self.natural_language_classifier.classify('beb9bfx46-nlc-100', content)
        return classes

if __name__ == "__main__":
    f = Furikome()
    print(f.recode("こんにちは"))
#     print(f.recode("振り込んで"))
#     print(f.recode("振り込んで"))
#     print(f.recode("振り込んで"))
#     print(f.recode("振り込んで"))
#     print(f.recode("振り込んで"))
