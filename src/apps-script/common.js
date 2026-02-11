var MAX_MESSAGE_LENGTH = 40;
var TunnelURL = "https://unmatching-sandy-hydrocinnamyl.ngrok-free.dev"; // 테스트 할때 마다 수시로 변경
const WEBAPP_URL = "https://script.google.com/macros/s/AKfycbwnEEYxJvAzGDrhEl5iY9PL79W60ZDTCKjreHXWbXjt/dev";


function onHomepage(e) {

  sendFirstMail();   // 서버 통신 확인용

  var inputSection = CardService.newCardSection().setHeader("💬 서버 질의");
  var input = CardService.newTextInput()
    .setFieldName("message")
    .setTitle("서버로 보낼 메시지")
    .setHint("메시지를 입력하세요")
    .setMultiline(true);

  var sendMessageToServerAction = CardService.newAction().setFunctionName("sendMessageToServer");
  var extractGmailAction = CardService.newAction().setFunctionName("exportAllInboxAndSentIntoOneTxt");
  
  var querySendButton = CardService.newTextButton()
    .setText("서버로 질의전송")
    .setOnClickAction(sendMessageToServerAction);

  var extractGmailButton = CardService.newTextButton()
    .setText("서버로 Gmail 내역 전송")
    .setOnClickAction(extractGmailAction);  

  const openWebBtn = CardService.newTextButton()
    .setText("웹 페이지 열기 (Web App)")
    .setOpenLink(
      CardService.newOpenLink()
        .setUrl(WEBAPP_URL)
        .setOpenAs(CardService.OpenAs.FULL_SIZE) // 새 창(풀페이지)로
    ); 

  const openWebSection = CardService.newCardSection()
    .setHeader("테스트")
    .addWidget(CardService.newTextParagraph().setText("버튼을 누르면 Web App 페이지가 열립니다."))
    .addWidget(openWebBtn);
  var section = CardService.newCardSection().setHeader("📅 최근 메일 → 캘린더 자동 추가");

  section.addWidget(
    CardService.newTextParagraph().setText(
      "버튼을 누르면 받은편지함의 가장 최근 메일 1개에서 일정 정보를 추출(서버/LLM)하고 기본 캘린더에 등록합니다."
    )
  );

    section.addWidget(
    CardService.newTextButton()
      .setText("✅ 최근 메일로 일정 추가")
      .setOnClickAction(CardService.newAction().setFunctionName("createEventFromLatestMail"))
  );

  inputSection.addWidget(input);
  inputSection.addWidget(querySendButton);
  inputSection.addWidget(extractGmailButton);

  return CardService.newCardBuilder()
    .addSection(inputSection)
    .addSection(section)
    .addSection(openWebSection)
    .build();
}

function sendMessageToServer(e) {
  var text = (e && e.formInput && e.formInput.message) ? e.formInput.message : "";

 var response = UrlFetchApp.fetch(TunnelURL + "/run-query", {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify({
      message: text,
      resMethod: "local",
      resType: "text"
    })
  });
 var raw = response.getContentText();
  Logger.log("Raw response: " + raw);

  var resultText = raw;
  try {
    var data = JSON.parse(raw);
    resultText = data.result || raw;
  } catch (err) {
    resultText = raw;
  }

  // 응답을 카드로 보여주기
  var card = CardService.newCardBuilder()
    .addSection(
      CardService.newCardSection()
        .setHeader("✅ 서버 응답")
        .addWidget(CardService.newTextParagraph().setText(resultText))
    )
    .build();

  return CardService.newActionResponseBuilder()
    .setNavigation(CardService.newNavigation().pushCard(card))
    .build();
    }

function truncate(message) {
  if (message.length > MAX_MESSAGE_LENGTH) {
    message = message.slice(0, MAX_MESSAGE_LENGTH);
    message = message.slice(0, message.lastIndexOf(" ")) + "...";
  }
  return message;
}

// 웹앱 열기 버튼 카드 빌더
function buildCard() {
  return CardService.newCardBuilder()
    .addSection(
      CardService.newCardSection()
        .addWidget(
          CardService.newTextButton()
            .setText("웹 설정 열기")
            .setOpenLink(
              CardService.newOpenLink()
                .setUrl(WEBAPP_URL)
                .setOpenAs(CardService.OpenAs.FULL_SIZE)
            )
        )
    )
    .build();
}

/**
 * 받은편지함 최근 메일 1개 가져오기
 */
function getLatestInboxMessage_() {
  var threads = GmailApp.getInboxThreads(0, 1);
  if (!threads || threads.length === 0) throw new Error("받은편지함에 메일이 없습니다.");

  var msgs = threads[0].getMessages();
  if (!msgs || msgs.length === 0) throw new Error("스레드에 메시지가 없습니다.");

  return msgs[msgs.length - 1]; // 가장 최근 메시지
}

/**
 * 서버(/run-query)로 보내서 JSON 문자열을 받아오고,
 * 파싱 후 캘린더에 일정 추가
 */
function createEventFromLatestMail(e) {
  try {
    var msg = getLatestInboxMessage_();

    var subject = msg.getSubject() || "";
    var from = msg.getFrom() || "";
    var body = msg.getPlainBody() || "";
    var mailDate = msg.getDate(); // Date 객체

    // ✅ LLM에게 "JSON만" 출력하도록 강하게 강제
    // - date/time 못 뽑으면 start는 "내일 09:00", end는 "내일 10:00" 같은 기본값 넣도록 강제하면 자동화가 끊기지 않음
    // - timezone은 Asia/Seoul 고정
var prompt =
  "아래 이메일에서 일정 정보를 '추출'해. 생성/추측 금지.\n" +
  "반드시 JSON만 출력해. (설명문/코드블록/백틱/마크다운/추가 텍스트 절대 금지)\n" +
  "첫 글자는 {, 마지막 글자는 }.\n\n" +

  "출력 JSON 스키마:\n" +
  "{\n" +
  '  "title": "일정 제목",\n' +
  '  "description": "상세 내용",\n' +
  '  "start": "YYYY-MM-DDTHH:MM:SS+09:00",\n' +
  '  "end": "YYYY-MM-DDTHH:MM:SS+09:00",\n' +
  '  "timezone": "Asia/Seoul",\n' +
  '  "location": "장소(없으면 빈문자열)",\n' +
  '  "evidence": {\n' +
  '    "date_text": "원문에서 가져온 날짜 표현",\n' +
  '    "time_text": "원문에서 가져온 시간 표현",\n' +
  '    "source": "subject|body|both",\n' +
  '    "fallback_used": false\n' +
  "  }\n" +
  "}\n\n" +

  "규칙:\n" +
  "1) 이메일에 명시된 날짜/시간이 있으면 반드시 그것을 사용해.\n" +
  "2) 날짜는 subject/body에서 찾고, 시간이 body에 있으면 그 시간을 우선 사용해.\n" +
  '3) timezone은 "Asia/Seoul"로 고정해.\n' +
  "4) end는 start + 1시간으로 설정하되, 이메일에 종료 시간이 있으면 그걸 사용해.\n" +
  "5) 이메일에서 날짜 또는 시간이 '전혀' 추출되지 않을 때만 fallback 사용:\n" +
  "   - start: (메일 작성일 기준) 다음날 09:00\n" +
  "   - end: 다음날 10:00\n" +
  "6) evidence에 추출 근거를 넣어(원문에서 가져온 짧은 구절). 날짜/시간을 못 찾았으면 빈 문자열로.\n\n" +

  "이메일 메타:\n" +
  "- subject: " + subject + "\n" +
  "- from: " + from + "\n" +
  "- mail_date(UTC): " + (mailDate ? mailDate.toISOString() : "") + "\n\n" +

  "이메일 본문:\n" +
  body;


    // ✅ 이미 구현된 /run-query 사용
    var extractedText = callRunQuery_(prompt); // 문자열 (JSON만 있어야 함)

    // ✅ JSON 파싱
    var eventObj = safeJsonParse_(extractedText);
    validateEventObj_(eventObj);

    // ✅ 캘린더 일정 생성
    var eventId = insertCalendarEvent_(eventObj);

    // ✅ 결과 카드
    var card = CardService.newCardBuilder()
      .addSection(
        CardService.newCardSection()
          .setHeader("✅ 캘린더 일정 추가 완료")
          .addWidget(CardService.newTextParagraph().setText("제목: " + eventObj.title))
          .addWidget(CardService.newTextParagraph().setText("시작: " + eventObj.start))
          .addWidget(CardService.newTextParagraph().setText("종료: " + eventObj.end))
          .addWidget(CardService.newTextParagraph().setText("Event ID: " + eventId))
      )
      .build();

    return CardService.newActionResponseBuilder()
      .setNavigation(CardService.newNavigation().pushCard(card))
      .build();

  } catch (err) {
    var cardErr = CardService.newCardBuilder()
      .addSection(
        CardService.newCardSection()
          .setHeader("❌ 실패")
          .addWidget(CardService.newTextParagraph().setText(String(err && err.message ? err.message : err)))
      )
      .build();

    return CardService.newActionResponseBuilder()
      .setNavigation(CardService.newNavigation().pushCard(cardErr))
      .build();
  }
}

/**
 * 네가 만든 sendMessageToServer 스타일을 "프롬프트 전송 전용"으로 분리한 버전
 * - 반환: data.result (문자열)
 */
function callRunQuery_(promptText) {
  var response = UrlFetchApp.fetch(TunnelURL + "/run-query", {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify({
      message: promptText,
      resMethod: "local",
      resType: "text" // ✅ 그대로 text 사용 (JSON만 출력하도록 프롬프트에서 강제)
    }),
    muteHttpExceptions: true
  });

  var raw = response.getContentText();
  Logger.log("Raw response: " + raw);

  var code = response.getResponseCode();
  if (code < 200 || code >= 300) {
    throw new Error("서버 오류(" + code + "): " + raw);
  }

  var data;
  try {
    data = JSON.parse(raw);
  } catch (e) {
    throw new Error("서버 응답이 JSON이 아닙니다: " + raw);
  }

  if (data.error) throw new Error("서버 error: " + data.error);
  if (!data.result) throw new Error("서버 result가 비어있습니다.");

  return String(data.result).trim();
}

/**
 * LLM이 JSON만 준다고 가정하지만,
 * 혹시 앞뒤에 이상한 텍스트가 섞일 때를 대비해서
 * 첫 '{' ~ 마지막 '}' 구간만 잘라 파싱하는 방어 코드
 */
function safeJsonParse_(text) {
  var s = String(text || "").trim();
  var first = s.indexOf("{");
  var last = s.lastIndexOf("}");
  if (first === -1 || last === -1 || last <= first) {
    throw new Error("LLM 응답에서 JSON 객체를 찾을 수 없습니다: " + s);
  }
  var jsonStr = s.substring(first, last + 1);

  try {
    return JSON.parse(jsonStr);
  } catch (e) {
    throw new Error("JSON 파싱 실패: " + jsonStr);
  }
}

function validateEventObj_(obj) {
  if (!obj) throw new Error("추출 결과가 비었습니다.");
  if (!obj.title) throw new Error("title이 없습니다.");
  if (!obj.start) throw new Error("start가 없습니다.");
  if (!obj.end) throw new Error("end가 없습니다.");
  if (!obj.timezone) obj.timezone = "Asia/Seoul";
  if (!obj.description) obj.description = "";
  if (!obj.location) obj.location = "";
}

function insertCalendarEvent_(eventObj) {
  var cal = CalendarApp.getDefaultCalendar();

  var start = new Date(eventObj.start);
  var end = new Date(eventObj.end);

  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    throw new Error("start/end 날짜 파싱 실패: " + eventObj.start + " ~ " + eventObj.end);
  }
  if (end.getTime() <= start.getTime()) {
    // 혹시 역전되면 1시간 기본값
    end = new Date(start.getTime() + 60 * 60 * 1000);
  }

  var options = {
    description: eventObj.description || "",
    location: eventObj.location || ""
  };

  var event = cal.createEvent(eventObj.title, start, end, options);
  return event.getId();
}
