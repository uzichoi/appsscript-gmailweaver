function doGet(e) {
  return HtmlService.createHtmlOutputFromFile("index")
    .setTitle("Web UI");
}

/**
 * (선택) Web App 페이지에서 GmailApp 호출 테스트용
 * index.html에서 google.script.run으로 호출함
 */
function getInboxTopSubjects(limit) {
  const n = Math.max(1, Math.min(Number(limit || 5), 20));
  const threads = GmailApp.getInboxThreads(0, n);
  return threads.map(t => t.getFirstMessageSubject());
}

/**
 * ✅ 그래프 데이터 반환
 * - Drive 업로드 없이, Apps Script 프로젝트에 포함된 파일에서 읽어옴
 * - 아래 파일을 Apps Script 프로젝트에 추가해야 함:
 *   src/apps-script/graphml_data_json.html  (내용은 JSON 텍스트만: {"nodes":[...],"edges":[...]})
 */
function getGraphData() {
  const jsonText = HtmlService
    .createHtmlOutputFromFile("graphml_data_json")
    .getContent();

  return JSON.parse(jsonText); // { nodes: [...], edges: [...] }
}
