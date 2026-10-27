// 빼기(ppeggi) 앱 — 홍성군 대형폐기물 분류표
// 출처: 2026-10-27 앱 화면 캡처 85장 전사. 구조: 대분류 → 중분류 타일 → (상세 카테고리) → 규격.
// 앱은 규격을 고르기 전까지 금액을 "- 원"으로 숨기므로, 수수료는 조례 별표1(ref → pricelist.js) 값을 참고로 표시합니다.
// inferred:true 는 캡처에서 상위 타일이 가려져 추정한 위치입니다. 앱에서 다르면 tile 값만 옮기세요.
window.PPEGGI = {
  ready: true,
  source: "빼기 앱 홍성군 분류표 (2026-10-27 화면 기준)",
  feeNote: "표시 금액은 홍성군 조례 별표1 기준이며, 실제 결제 금액은 빼기 앱에서 규격 선택 후 확인됩니다.",
  categories: [
    { id: "furniture", name: "가구", tiles: [
      { name: "침대/매트리스", items: [
        { id: "bed", name: "침대", ref: "bed" },
        { id: "mattress", name: "매트리스", ref: "mattress" } ] },
      { name: "소파", items: [ { id: "sofa", name: "쇼파", aliases: ["소파"], ref: "sofa" } ] },
      { name: "거실장/테이블/서랍장", items: [
        { id: "drawerchest", name: "서랍장", ref: "drawerchest" },
        { id: "drawer", name: "서랍", ref: "drawer" },
        { id: "cabinet", name: "장식장(찬장)", ref: "cabinet" },
        { id: "tvstand", name: "텔레비전받침대", aliases: ["TV장", "거실장"], ref: "tvstand" },
        { id: "coffeetable", name: "응접탁자", aliases: ["테이블", "탁자"], ref: "coffeetable" },
        { id: "mungap", name: "문갑", ref: "mungap" },
        { id: "lowtable", name: "밥상", ref: "lowtable" },
        { id: "gyojasang", name: "교자상", ref: "gyojasang" } ] },
      { name: "옷장/붙박이장/장롱", items: [ { id: "wardrobe", name: "장농", aliases: ["장롱", "옷장", "붙박이장"], ref: "wardrobe" } ] },
      { name: "책상", items: [ { id: "desk", name: "책상", ref: "desk" } ] },
      { name: "의자", items: [ { id: "chair", name: "의자", ref: "chair" } ] },
      { name: "책장", items: [
        { id: "bookshelf", name: "책장", ref: "bookshelf" },
        { id: "bookstand", name: "책꽂이", ref: "bookstand" } ] },
      { name: "선반/수납가구", items: [
        { id: "shoerack", name: "신발장", ref: "shoerack", inferred: true },
        { id: "displayrack", name: "선반/진열대", aliases: ["진열대", "선반"], ref: "displayrack" },
        { id: "hanger", name: "옷걸이", aliases: ["행거"], ref: "hanger" },
        { id: "towelbox", name: "목욕탕수건함", ref: "towelbox", inferred: true } ] },
      { name: "식탁", items: [ { id: "diningtable", name: "식탁", ref: "diningtable" } ] },
      { name: "침구", items: [ { id: "bedding", name: "이불", aliases: ["침구", "요"], ref: "bedding" } ] },
      { name: "화장대", items: [ { id: "dresser", name: "화장대", ref: "dresser" } ] },
      { name: "거울/액자", items: [
        { id: "mirror", name: "거울", ref: "mirror" },
        { id: "frame", name: "액자", ref: "frame" },
        { id: "brokenglass", name: "깨진유리", aliases: ["유리"], ref: "brokenglass", inferred: true } ] },
      { name: "카페트(러그)", items: [ { id: "carpet", name: "카펫트", aliases: ["카페트", "카펫", "러그"], ref: "carpet" } ] },
      { name: "주방가구", items: [ { id: "sink", name: "씽크대", aliases: ["싱크대"], ref: "sink" } ] },
      { name: "조명/스탠드", items: [
        { id: "lampframe", name: "형광등틀", aliases: ["조명", "스탠드", "등기구"], ref: "lampframe" },
        { id: "blind", name: "블라인드", aliases: ["커튼"], ref: "blind", inferred: true } ] },
      { name: "문짝/창문류", items: [ { id: "door", name: "문짝", aliases: ["문", "창문"], ref: "door" } ] },
      { name: "장판", items: [ { id: "linoleum", name: "장판", ref: "linoleum" } ] }
    ] },
    { id: "appliance", name: "가전", tiles: [
      { name: "주방가전", items: [
        { id: "ricecooker", name: "전기밥통", aliases: ["밥솥"], ref: "ricecooker" },
        { id: "gasrange", name: "가스렌지", aliases: ["가스레인지", "인덕션"], ref: "gasrange" },
        { id: "mixer", name: "믹서", aliases: ["믹서기", "블렌더"], ref: "mixer" },
        { id: "juicer", name: "녹즙기", aliases: ["착즙기"], ref: "mixer" },
        { id: "gasoven", name: "가스오븐렌지", aliases: ["오븐"], ref: "gasoven" },
        { id: "dishdryer", name: "식기건조기", ref: "dishdryer" },
        { id: "fridge", name: "냉장고", aliases: ["김치냉장고"], ref: "fridge", inferred: true },
        { id: "microwave", name: "전자렌지", aliases: ["전자레인지"], ref: "microwave", inferred: true },
        { id: "dishwasher", name: "식기세척기", ref: "dishwasher", inferred: true },
        { id: "purifier", name: "정수기", ref: "purifier", inferred: true } ] },
      { name: "여름가전", items: [
        { id: "fan", name: "선풍기", aliases: ["써큘레이터"], ref: "fan" },
        { id: "aircon", name: "에어컨", aliases: ["에어콘"], ref: "aircon", inferred: true },
        { id: "aircon_out", name: "에어컨 실외기", aliases: ["실외기"], ref: "aircon_out", inferred: true } ] },
      { name: "청소기", items: [ { id: "vacuum", name: "청소기", aliases: ["로봇청소기"], ref: "vacuum" } ] },
      { name: "계절가전", items: [
        { id: "humidifier", name: "가습기", aliases: ["제습기"], ref: "humidifier" },
        { id: "ventfan", name: "환풍기", aliases: ["후드"], ref: "ventfan" },
        { id: "airpurifier", name: "공기청정기", ref: "airpurifier", inferred: true } ] },
      { name: "생활가전", items: [
        { id: "iron", name: "전기다리미", aliases: ["다리미"], ref: "iron" },
        { id: "sewing", name: "재봉틀", aliases: ["미싱"], ref: "sewing" },
        { id: "washer", name: "세탁기", aliases: ["건조기"], ref: "washer", inferred: true },
        { id: "spinner", name: "탈수기", ref: "spinner", inferred: true } ] },
      { name: "난방가전", items: [
        { id: "jademat", name: "옥매트", aliases: ["온열매트"], ref: "jademat" },
        { id: "eblanket", name: "전기담요", aliases: ["전기장판"], ref: "eblanket" },
        { id: "heater_air", name: "온풍기", ref: "aircon" },
        { id: "heater", name: "난로", aliases: ["히터"], ref: "heater" },
        { id: "boiler", name: "보일러", aliases: ["온수기"], ref: "boiler" } ] },
      { name: "영상가전", items: [
        { id: "video", name: "비디오(DVD)", aliases: ["DVD", "셋톱박스"], ref: "video" },
        { id: "tv", name: "텔레비전", aliases: ["TV", "티비"], ref: "tv", inferred: true } ] }
    ] },
    { id: "health", name: "건강/의료용품", tiles: [
      { name: "안마용품", items: [ { id: "massagechair", name: "안마의자", aliases: ["안마기"], ref: "massagechair" } ] }
    ] },
    { id: "living", name: "생활/주방용품", tiles: [
      { name: "패션잡화", items: [ { id: "bag", name: "가방", aliases: ["캐리어"], ref: "bag" } ] },
      { name: "유아용품", items: [
        { id: "toy", name: "장난감", aliases: ["완구"], ref: "toy" },
        { id: "doll", name: "인형", ref: "doll" },
        { id: "stroller", name: "유모차", aliases: ["유아차"], ref: "stroller" } ] },
      { name: "애완용품", items: [ { id: "aquarium", name: "수족관", aliases: ["어항"], ref: "aquarium" } ] },
      { name: "수납/정리용품", items: [
        { id: "filecabinet", name: "캐비넷", aliases: ["사물함", "락커"], ref: "filecabinet", inferred: true },
        { id: "displayrack2", name: "진열대", ref: "displayrack" } ] },
      { name: "세탁용품", items: [
        { id: "dryrack", name: "빨래건조대", aliases: ["건조대"], ref: "dryrack" },
        { id: "ironboard", name: "다림판(다리미판)", aliases: ["다리미판", "다림질판"], ref: "ironboard" } ] },
      { name: "욕실용품", items: [
        { id: "bidet", name: "비데", ref: "bidet" },
        { id: "washbasin", name: "세면기(세면대)", aliases: ["세면대"], ref: "washbasin" },
        { id: "toilet", name: "변기", aliases: ["양변기"], ref: "toilet" },
        { id: "bathtub", name: "욕조", ref: "bathtub" } ] },
      { name: "보관/밀폐용기", items: [
        { id: "ricebox", name: "쌀통", ref: "ricebox" },
        { id: "jar", name: "항아리", aliases: ["독", "옹기"], ref: "jar" } ] },
      { name: "청소용품", items: [ { id: "trashcan", name: "쓰레기통", aliases: ["휴지통"], ref: "trashcan" } ] }
    ] },
    { id: "sports", name: "스포츠/레저", tiles: [
      { name: "운동기구", items: [
        { id: "bike_fitness", name: "헬스자전거", aliases: ["실내자전거"], ref: "bike_fitness" },
        { id: "treadmill", name: "런닝머신", aliases: ["러닝머신"], ref: "treadmill", inferred: true } ] },
      { name: "자전거", items: [
        { id: "bicycle_adult", name: "일반자전거", aliases: ["자전거"], ref: "bicycle", specIdx: 0 },
        { id: "bicycle_kid", name: "아동용 자전거", ref: "bicycle", specIdx: 1 } ] }
    ] },
    { id: "music", name: "악기", tiles: [
      { name: "피아노", items: [
        { id: "piano_up", name: "일반피아노(업라이트)", aliases: ["피아노"], ref: "piano", specIdx: 1 },
        { id: "piano_grand", name: "그랜드피아노", ref: "piano", specIdx: 0 } ] },
      { name: "건반악기", items: [ { id: "organ", name: "오르간", aliases: ["전자피아노", "디지털피아노", "키보드"], ref: "organ" } ] }
    ] },
    { id: "car", name: "자동차/공구", tiles: [
      { name: "안전용품", items: [ { id: "extinguisher", name: "소화기", ref: "extinguisher" } ] }
    ] },
    { id: "hobby", name: "취미/문구용품", tiles: [
      { name: "원예용품/식물", items: [ { id: "pot", name: "화분", ref: "pot" } ] },
      { name: "문구/사무용품", items: [ { id: "blackboard", name: "칠판", aliases: ["화이트보드"], ref: "blackboard" } ] },
      { name: "게임", items: [ { id: "arcade", name: "오락기", aliases: ["게임기"], ref: "arcade" } ] }
    ] },
    { id: "digital", name: "컴퓨터/디지털", tiles: [
      { name: "복합기/프린터", items: [
        { id: "printer", name: "프린터", aliases: ["복합기"], ref: "printer" },
        { id: "fax", name: "팩스", ref: "fax" },
        { id: "shredder", name: "세단기", aliases: ["파쇄기"], ref: "shredder" },
        { id: "pc", name: "컴퓨터 본체", aliases: ["컴퓨터", "데스크탑"], ref: "pc", inferred: true },
        { id: "monitor", name: "모니터", ref: "monitor", inferred: true } ] },
      { name: "음향기기", items: [
        { id: "speaker", name: "스피커", ref: "speaker" },
        { id: "cassette", name: "카세트", aliases: ["라디오"], ref: "cassette" },
        { id: "audio", name: "전축(오디오)", aliases: ["오디오"], ref: "audio", inferred: true } ] }
    ] },
    { id: "etc", name: "기타", tiles: [
      { name: "기타", items: [
        { id: "other", name: "상기이외품목중 쓰레기봉투에담기어려운폐기물", aliases: ["기타", "그 외", "잡동사니"], ref: "other" },
        { id: "watertank", name: "물탱크", ref: "watertank" },
        { id: "construction", name: "공사장생활폐기물", aliases: ["공사 폐기물", "건축 폐기물", "인테리어 폐기물"],
          specs: [["0.1㎥당 (운반비 포함)", null], ["0.1㎥당 (운반비 제외)", null]], note: "금액은 빼기 앱에서 규격 선택 후 표시됩니다." },
        { id: "apartment", name: "공동주택 대형폐기물", aliases: ["아파트 대형폐기물"],
          specs: [["모든 규격", null]], note: "공동주택 관리사무소를 통한 배출용 항목입니다. 금액은 앱에서 확인하세요." } ] }
    ] }
  ]
};
