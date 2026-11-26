import { GovtLevel, ImplementationIndicator, Province } from '../types/index.ts';

export const PROVINCES: Province[] = [
  { id: 1, code: 'P1', name_np: 'कोशी प्रदेश', name_en: 'Koshi Province' },
  { id: 2, code: 'P2', name_np: 'मधेश प्रदेश', name_en: 'Madhesh Province' },
  { id: 3, code: 'P3', name_np: 'बागमती प्रदेश', name_en: 'Bagmati Province' },
  { id: 4, code: 'P4', name_np: 'गण्डकी प्रदेश', name_en: 'Gandaki Province' },
  { id: 5, code: 'P5', name_np: 'लुम्बिनी प्रदेश', name_en: 'Lumbini Province' },
  { id: 6, code: 'P6', name_np: 'कर्णाली प्रदेश', name_en: 'Karnali Province' },
  { id: 7, code: 'P7', name_np: 'सुदूरपश्चिम प्रदेश', name_en: 'Sudurpashchim Province' },
];

export interface DistrictSeed {
  id: number;
  province_id: number;
  geo_key: string;
  name_np: string;
  name_en: string;
}

// All 77 Districts mapped accurately to GeoJSON DISTRICT property keys
export const DISTRICTS_77: DistrictSeed[] = [
  // Province 1: Koshi (14)
  { id: 1, province_id: 1, geo_key: 'BHOJPUR', name_np: 'भोजपुर', name_en: 'Bhojpur' },
  { id: 2, province_id: 1, geo_key: 'DHANKUTA', name_np: 'धनकुटा', name_en: 'Dhankuta' },
  { id: 3, province_id: 1, geo_key: 'ILAM', name_np: 'इलाम', name_en: 'Ilam' },
  { id: 4, province_id: 1, geo_key: 'JHAPA', name_np: 'झापा', name_en: 'Jhapa' },
  { id: 5, province_id: 1, geo_key: 'KHOTANG', name_np: 'खोटाङ', name_en: 'Khotang' },
  { id: 6, province_id: 1, geo_key: 'MORANG', name_np: 'मोरङ', name_en: 'Morang' },
  { id: 7, province_id: 1, geo_key: 'OKHALDHUNGA', name_np: 'ओखलढुङ्गा', name_en: 'Okhaldhunga' },
  { id: 8, province_id: 1, geo_key: 'PANCHTHAR', name_np: 'पाँचथर', name_en: 'Panchthar' },
  { id: 9, province_id: 1, geo_key: 'SANKHUWASABHA', name_np: 'संखुवासभा', name_en: 'Sankhuwasabha' },
  { id: 10, province_id: 1, geo_key: 'SOLUKHUMBU', name_np: 'सोलुखुम्बु', name_en: 'Solukhumbu' },
  { id: 11, province_id: 1, geo_key: 'SUNSARI', name_np: 'सुनसरी', name_en: 'Sunsari' },
  { id: 12, province_id: 1, geo_key: 'TAPLEJUNG', name_np: 'ताप्लेजुङ', name_en: 'Taplejung' },
  { id: 13, province_id: 1, geo_key: 'TEHRATHUM', name_np: 'तेह्रथुम', name_en: 'Tehrathum' },
  { id: 14, province_id: 1, geo_key: 'UDAYAPUR', name_np: 'उदयपुर', name_en: 'Udayapur' },

  // Province 2: Madhesh (8)
  { id: 15, province_id: 2, geo_key: 'BARA', name_np: 'बारा', name_en: 'Bara' },
  { id: 16, province_id: 2, geo_key: 'DHANUSA', name_np: 'धनुषा', name_en: 'Dhanusha' },
  { id: 17, province_id: 2, geo_key: 'MAHOTTARI', name_np: 'महोत्तरी', name_en: 'Mahottari' },
  { id: 18, province_id: 2, geo_key: 'PARSA', name_np: 'पर्सा', name_en: 'Parsa' },
  { id: 19, province_id: 2, geo_key: 'RAUTAHAT', name_np: 'रौतहट', name_en: 'Rautahat' },
  { id: 20, province_id: 2, geo_key: 'SAPTARI', name_np: 'सप्तरी', name_en: 'Saptari' },
  { id: 21, province_id: 2, geo_key: 'SARLAHI', name_np: 'सर्लाही', name_en: 'Sarlahi' },
  { id: 22, province_id: 2, geo_key: 'SIRAHA', name_np: 'सिराहा', name_en: 'Siraha' },

  // Province 3: Bagmati (13)
  { id: 23, province_id: 3, geo_key: 'BHAKTAPUR', name_np: 'भक्तपुर', name_en: 'Bhaktapur' },
  { id: 24, province_id: 3, geo_key: 'CHITWAN', name_np: 'चितवन', name_en: 'Chitwan' },
  { id: 25, province_id: 3, geo_key: 'DHADING', name_np: 'धादिङ', name_en: 'Dhading' },
  { id: 26, province_id: 3, geo_key: 'DOLAKHA', name_np: 'दोलखा', name_en: 'Dolakha' },
  { id: 27, province_id: 3, geo_key: 'KATHMANDU', name_np: 'काठमाडौं', name_en: 'Kathmandu' },
  { id: 28, province_id: 3, geo_key: 'KAVREPALANCHOWK', name_np: 'काभ्रेपलाञ्चोक', name_en: 'Kavrepalanchowk' },
  { id: 29, province_id: 3, geo_key: 'LALITPUR', name_np: 'ललितपुर', name_en: 'Lalitpur' },
  { id: 30, province_id: 3, geo_key: 'MAKWANPUR', name_np: 'मकवानपुर', name_en: 'Makwanpur' },
  { id: 31, province_id: 3, geo_key: 'NUWAKOT', name_np: 'नुवाकोट', name_en: 'Nuwakot' },
  { id: 32, province_id: 3, geo_key: 'RAMECHHAP', name_np: 'रामेछाप', name_en: 'Ramechhap' },
  { id: 33, province_id: 3, geo_key: 'RASUWA', name_np: 'रसुवा', name_en: 'Rasuwa' },
  { id: 34, province_id: 3, geo_key: 'SINDHULI', name_np: 'सिन्धुली', name_en: 'Sindhuli' },
  { id: 35, province_id: 3, geo_key: 'SINDHUPALCHOK', name_np: 'सिन्धुपाल्चोक', name_en: 'Sindhupalchowk' },

  // Province 4: Gandaki (11)
  { id: 36, province_id: 4, geo_key: 'BAGLUNG', name_np: 'बागलुङ', name_en: 'Baglung' },
  { id: 37, province_id: 4, geo_key: 'GORKHA', name_np: 'गोरखा', name_en: 'Gorkha' },
  { id: 38, province_id: 4, geo_key: 'KASKI', name_np: 'कास्की', name_en: 'Kaski' },
  { id: 39, province_id: 4, geo_key: 'LAMJUNG', name_np: 'लमजुङ', name_en: 'Lamjung' },
  { id: 40, province_id: 4, geo_key: 'MANANG', name_np: 'मनाङ', name_en: 'Manang' },
  { id: 41, province_id: 4, geo_key: 'MUSTANG', name_np: 'मुस्ताङ', name_en: 'Mustang' },
  { id: 42, province_id: 4, geo_key: 'MYAGDI', name_np: 'म्याग्दी', name_en: 'Myagdi' },
  { id: 43, province_id: 4, geo_key: 'NAWALPUR', name_np: 'नवलपुर (बर्दघाट सुस्ता पूर्व)', name_en: 'Nawalpur' },
  { id: 44, province_id: 4, geo_key: 'PARBAT', name_np: 'पर्वत', name_en: 'Parbat' },
  { id: 45, province_id: 4, geo_key: 'SYANGJA', name_np: 'स्याङ्जा', name_en: 'Syangja' },
  { id: 46, province_id: 4, geo_key: 'TANAHU', name_np: 'तनहुँ', name_en: 'Tanahun' },

  // Province 5: Lumbini (12)
  { id: 47, province_id: 5, geo_key: 'ARGHAKHANCHI', name_np: 'अर्घाखाँची', name_en: 'Arghakhanchi' },
  { id: 48, province_id: 5, geo_key: 'BANKE', name_np: 'बाँके', name_en: 'Banke' },
  { id: 49, province_id: 5, geo_key: 'BARDIYA', name_np: 'बर्दिया', name_en: 'Bardiya' },
  { id: 50, province_id: 5, geo_key: 'DANG', name_np: 'दाङ', name_en: 'Dang' },
  { id: 51, province_id: 5, geo_key: 'EASTERN RUKUM', name_np: 'पूर्वी रुकुम', name_en: 'Eastern Rukum' },
  { id: 52, province_id: 5, geo_key: 'GULMI', name_np: 'गुल्मी', name_en: 'Gulmi' },
  { id: 53, province_id: 5, geo_key: 'KAPILVASTU', name_np: 'कपिलवस्तु', name_en: 'Kapilvastu' },
  { id: 54, province_id: 5, geo_key: 'PALPA', name_np: 'पाल्पा', name_en: 'Palpa' },
  { id: 55, province_id: 5, geo_key: 'PARASI', name_np: 'परासी (बर्दघाट सुस्ता पश्चिम)', name_en: 'Parasi' },
  { id: 56, province_id: 5, geo_key: 'PYUTHAN', name_np: 'प्युठान', name_en: 'Pyuthan' },
  { id: 57, province_id: 5, geo_key: 'ROLPA', name_np: 'रोल्पा', name_en: 'Rolpa' },
  { id: 58, province_id: 5, geo_key: 'RUPANDEHI', name_np: 'रुपन्देही', name_en: 'Rupandehi' },

  // Province 6: Karnali (10)
  { id: 59, province_id: 6, geo_key: 'DAILEKH', name_np: 'दैलेख', name_en: 'Dailekh' },
  { id: 60, province_id: 6, geo_key: 'DOLPA', name_np: 'डोल्पा', name_en: 'Dolpa' },
  { id: 61, province_id: 6, geo_key: 'HUMLA', name_np: 'हुम्ला', name_en: 'Humla' },
  { id: 62, province_id: 6, geo_key: 'JAJARKOT', name_np: 'जाजरकोट', name_en: 'Jajarkot' },
  { id: 63, province_id: 6, geo_key: 'JUMLA', name_np: 'जुम्ला', name_en: 'Jumla' },
  { id: 64, province_id: 6, geo_key: 'KALIKOT', name_np: 'कालिकोट', name_en: 'Kalikot' },
  { id: 65, province_id: 6, geo_key: 'MUGU', name_np: 'मुगु', name_en: 'Mugu' },
  { id: 66, province_id: 6, geo_key: 'SALYAN', name_np: 'सल्यान', name_en: 'Salyan' },
  { id: 67, province_id: 6, geo_key: 'SURKHET', name_np: 'सुर्खेत', name_en: 'Surkhet' },
  { id: 68, province_id: 6, geo_key: 'WESTERN RUKUM', name_np: 'पश्चिम रुकुम', name_en: 'Western Rukum' },

  // Province 7: Sudurpashchim (9)
  { id: 69, province_id: 7, geo_key: 'ACHHAM', name_np: 'अछाम', name_en: 'Achham' },
  { id: 70, province_id: 7, geo_key: 'BAITADI', name_np: 'बैतडी', name_en: 'Baitadi' },
  { id: 71, province_id: 7, geo_key: 'BAJHANG', name_np: 'बझाङ', name_en: 'Bajhang' },
  { id: 72, province_id: 7, geo_key: 'BAJURA', name_np: 'बाजुरा', name_en: 'Bajura' },
  { id: 73, province_id: 7, geo_key: 'DADELDHURA', name_np: 'डडेलधुरा', name_en: 'Dadeldhura' },
  { id: 74, province_id: 7, geo_key: 'DARCHULA', name_np: 'दार्चुला', name_en: 'Darchula' },
  { id: 75, province_id: 7, geo_key: 'DOTI', name_np: 'डोटी', name_en: 'Doti' },
  { id: 76, province_id: 7, geo_key: 'KAILALI', name_np: 'कैलाली', name_en: 'Kailali' },
  { id: 77, province_id: 7, geo_key: 'KANCHANPUR', name_np: 'कञ्चनपुर', name_en: 'Kanchanpur' },
];

export const OFFICIAL_INDICATORS: ImplementationIndicator[] = [
  {
    id: 1,
    indicator_no: 1,
    title_np: 'प्रदान हुने सबै सार्वजनिक सेवाको पहिचान गरी प्रत्येक सेवाका लागि छुट्टै निवेदन ढाँचा तयार गरिएको।',
    title_en: 'All public services identified and a separate application template prepared for each service.',
    is_required: true,
  },
  {
    id: 2,
    indicator_no: 2,
    title_np: 'ढाँचामा सेवा/निवेदक/मागको विवरण, स्वघोषणा, दस्तुर, हस्ताक्षर, आवश्यक कागजात सूची र कार्यालय प्रयोजनका विवरण छन्; नेपालीमा/विद्युतीय रूपमा उपलब्ध',
    title_en: 'Template includes service/applicant/request details, self-declaration, fee, signature, required documents list, and official use section; available in Nepali/electronic format.',
    is_required: true,
  },
  {
    id: 3,
    indicator_no: 3,
    title_np: 'कार्यालय प्रमुखबाट ढाँचा स्वीकृत भई सोही ढाँचाको प्रयोग/कार्यान्वयन गरिएको।',
    title_en: 'Templates approved by the Office Head and implemented in actual service delivery.',
    is_required: true,
  },
  {
    id: 4,
    indicator_no: 4,
    title_np: 'स्वीकृत ढाँचा कार्यालयमा सार्वजनिक रूपमा राखिएको र सेवाग्राहीलाई निःशुल्क उपलब्ध',
    title_en: 'Approved templates publicly displayed in the office and provided free of cost to service seekers.',
    is_required: true,
  },
  {
    id: 5,
    indicator_no: 5,
    title_np: 'ढाँचा वेबसाइट/विद्युतीय माध्यममा डाउनलोड वा प्रयोग गर्न मिल्ने गरी राखिएको; सेवा प्रक्रिया, कागजात, शुल्क/दस्तुर र समयसीमा सार्वजनिक गरिएको',
    title_en: 'Templates uploaded to website/digital portal for download or use; service process, documents, fee, and timeline publicized.',
    is_required: true,
  },
  {
    id: 6,
    indicator_no: 6,
    title_np: 'निवेदनको विवरण अद्यावधिक, नियमित समीक्षा/अनुगमन र समस्या समाधानको व्यवस्था गरिएको',
    title_en: 'Application records updated, regular review/monitoring and grievance/problem resolution mechanism established.',
    is_required: true,
  },
  {
    id: 7,
    indicator_no: 7,
    title_np: 'नागरिक बडापत्र अद्यावधिक गरिएको',
    title_en: 'Citizen Charter updated in alignment with the directive.',
    is_required: true,
  },
  {
    id: 8,
    indicator_no: 8,
    title_np: 'सेवाग्राही सहायता कक्ष स्थापना गरिएको र सोका लागि कम्प्युटर, प्रिन्टर वा Digital Kiosk को व्यवस्था गरिएको',
    title_en: 'Service seeker help desk established with computer, printer, or Digital Kiosk.',
    is_required: true,
  },
  {
    id: 9,
    indicator_no: 9,
    title_np: 'कार्यालय परिसर वा कार्यालय वरिपरि निवेदन तयार गर्न, कागजात मिलाउन वा सेवा प्राप्त गराइदिन अनधिकृत व्यक्ति वा संस्थाले शुल्क लिएर वा नलिएर गर्ने कुरा बन्देज गरिएको',
    title_en: 'Unauthorized individuals/entities strictly prohibited from preparing applications or brokering services with or without fee within or around office premises.',
    is_required: true,
  },
];

export const MINISTRIES_SEED: Array<{
  id: number;
  code: string;
  name_np: string;
  name_en: string;
  govt_level: GovtLevel;
}> = [
  { id: 1, code: 'OPMCM', name_np: 'प्रधानमन्त्री तथा मन्त्रिपरिषद्को कार्यालय', name_en: 'Office of the Prime Minister and Council of Ministers', govt_level: 'federal' },
  { id: 2, code: 'MOHA', name_np: 'गृह मन्त्रालय', name_en: 'Ministry of Home Affairs', govt_level: 'federal' },
  { id: 3, code: 'MOF', name_np: 'अर्थ मन्त्रालय', name_en: 'Ministry of Finance', govt_level: 'federal' },
  { id: 4, code: 'MOFAGA', name_np: 'सङ्घीय मामिला तथा सामान्य प्रशासन मन्त्रालय', name_en: 'Ministry of Federal Affairs and General Administration', govt_level: 'local' },
  { id: 5, code: 'MOLCPA', name_np: 'भूमि व्यवस्था, सहकारी तथा गरिबी निवारण मन्त्रालय', name_en: 'Ministry of Land Management, Cooperatives and Poverty Alleviation', govt_level: 'federal' },
  { id: 6, code: 'MOPIT', name_np: 'भौतिक पूर्वाधार तथा यातायात मन्त्रालय', name_en: 'Ministry of Physical Infrastructure and Transport', govt_level: 'provincial' },
  { id: 7, code: 'MOHP', name_np: 'स्वास्थ्य तथा जनसङ्ख्या मन्त्रालय', name_en: 'Ministry of Health and Population', govt_level: 'federal' },
  { id: 8, code: 'MOEST', name_np: 'शिक्षा, विज्ञान तथा प्रविधि मन्त्रालय', name_en: 'Ministry of Education, Science and Technology', govt_level: 'federal' },
  { id: 9, code: 'MOALD', name_np: 'कृषि तथा पशुपन्छी विकास मन्त्रालय', name_en: 'Ministry of Agriculture and Livestock Development', govt_level: 'provincial' },
  { id: 10, code: 'MOICS', name_np: 'उद्योग, वाणिज्य तथा आपूर्ति मन्त्रालय', name_en: 'Ministry of Industry, Commerce and Supplies', govt_level: 'federal' },
  { id: 11, code: 'MOEWRI', name_np: 'ऊर्जा, जलस्रोत तथा सिँचाइ मन्त्रालय', name_en: 'Ministry of Energy, Water Resources and Irrigation', govt_level: 'federal' },
  { id: 12, code: 'MOLJPA', name_np: 'कानून, न्याय तथा संसदीय मामिला मन्त्रालय', name_en: 'Ministry of Law, Justice and Parliamentary Affairs', govt_level: 'federal' },
];
