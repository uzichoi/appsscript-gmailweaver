function doGet(e) {
  return HtmlService.createHtmlOutputFromFile("index")
    .setTitle("Gmail Network Graph")
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * Gmail 데이터를 분석하여 그래프 데이터 반환
 */
function getGraphData() {
  try {
    const threads = GmailApp.getInboxThreads(0, 50);
    const nodes = [];
    const edges = [];
    const nodeMap = new Map();
    
    threads.forEach((thread, idx) => {
      const messages = thread.getMessages();
      const subject = thread.getFirstMessageSubject();
      
      messages.forEach(msg => {
        const from = msg.getFrom();
        const to = msg.getTo();
        const fromEmail = extractEmail(from);
        const toEmails = to.split(',').map(e => extractEmail(e.trim()));
        
        // From 노드 추가
        if (!nodeMap.has(fromEmail)) {
          nodeMap.set(fromEmail, {
            id: fromEmail,
            entity_type: 'PERSON',
            description: from,
            degree: 0
          });
        }
        
        // To 노드들 추가 및 엣지 생성
        toEmails.forEach(toEmail => {
          if (toEmail && toEmail !== fromEmail) {
            if (!nodeMap.has(toEmail)) {
              nodeMap.set(toEmail, {
                id: toEmail,
                entity_type: 'PERSON',
                description: toEmail,
                degree: 0
              });
            }
            
            edges.push({
              source: fromEmail,
              target: toEmail,
              relationship: 'SENT_EMAIL',
              description: `Email: ${subject}`
            });
            
            nodeMap.get(fromEmail).degree++;
            nodeMap.get(toEmail).degree++;
          }
        });
      });
    });
    
    return {
      nodes: Array.from(nodeMap.values()),
      edges: edges
    };
  } catch (error) {
    return {
      error: error.toString(),
      nodes: [],
      edges: []
    };
  }
}

function extractEmail(str) {
  const match = str.match(/<(.+?)>/);
  return match ? match[1] : str.split('@')[0] || str;
}
