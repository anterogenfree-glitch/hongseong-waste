// 빼기(ppeggi) 앱 폐기물 분류표.
// ※ 홍성군 분류표 원본을 받으면 이 파일만 교체하면 됩니다. 구조:
//   categories: [{ id, name, items: [{ id, name, aliases:[], options:[{label, fee}] }] }]
// 아래는 자리 표시용 샘플이며, ready:false 이면 화면에 "준비 중" 안내가 표시됩니다.
window.PPEGGI = {
  ready: false,
  source: "빼기 앱 홍성군 분류표 (수신 대기)",
  categories: [
    { id: "furniture", name: "가구", items: [
      { id: "sofa", name: "소파", aliases: ["쇼파"], options: [{ label: "1인용" }, { label: "2~3인용" }, { label: "4인용 이상" }] },
      { id: "bed", name: "침대", aliases: ["침대틀"], options: [{ label: "싱글" }, { label: "더블·퀸" }] },
      { id: "wardrobe", name: "장롱·옷장", aliases: ["장농"], options: [{ label: "1쪽당" }] }
    ] },
    { id: "appliance", name: "가전", items: [
      { id: "fridge", name: "냉장고", aliases: [], options: [{ label: "모든 규격" }] },
      { id: "tv", name: "TV", aliases: ["텔레비전"], options: [{ label: "모든 규격" }] }
    ] },
    { id: "etc", name: "기타", items: [
      { id: "other", name: "기타 대형폐기물", aliases: [], options: [{ label: "직접 입력" }] }
    ] }
  ]
};
