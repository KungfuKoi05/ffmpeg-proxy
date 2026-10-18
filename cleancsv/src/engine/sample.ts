// A small, made-up customer list with typical problems, for "Try a sample file".
// Every name, email and phone number here is fictional. Phone numbers use the 555-01xx
// range reserved for fiction, and emails use example.com / example.org.

export const SAMPLE_FILE_NAME = 'sample-customers.csv'

export const SAMPLE_CSV = [
  'Customer ID,Name,Email ,Phone,Signup Date,Country,Category,Order Total,Notes',
  'C-1001,Ava Thompson,ava.thompson@example.com,(555) 010-0101,2026-01-14,USA,Electronics,"$1,249.00",Prefers email',
  'C-1002,  Liam Carter,liam.carter@example.com,555-010-0102,01/22/2026,United States,electronics,$89.50,',
  'C-1003,NOAH BENNETT,noah.bennett@example,555.010.0103,02/03/2026,US,Home & Garden,$320.00,Called twice',
  'C-1004,emma rodriguez,emma.rodriguez@example.org,+1 555 010 0104,"March 5, 2026",USA,Home and Garden,"$2,005.75",',
  'C-1005,Olivia Nguyen,olivia.nguyen@gmial.com,(555) 010-0105,2026-02-30,Canada,Toys,$45.00,N/A',
  'C-1006,Mason Patel,mason.patel@example.com,5550100106,03/14/2026,canada,ELECTRONICS,$610.20,',
  'C-1007,Sophia Kim,sophia.kim@example.com,(555) 010-0107,next tuesday,Canada,Toys,$15.99,NULL',
  'C-1008,Ethan Walker  ,ethan.walker@example.com,(555) 010-0108,2026-03-20,USA,Electroncs,$799.00,',
  'C-1001,Ava Thompson,ava.thompson@example.com,(555) 010-0101,2026-01-14,USA,Electronics,"$1,249.00",Prefers email',
  'C-1009,Isabella  Moore,isabella.moore@example.com,(555) 010-0109,04/02/2026,UK,Books,$22.40,',
  'C-1010,james o\'connor,james.oconnor@example.com,,04/18/2026,United Kingdom,books,$37.10,N/A',
  ',,,,,,,,',
  'C-1011,Mia Hernandez,MIA.HERNANDEZ@EXAMPLE.COM,(555) 010-0111,2026-04-25,USA,Toys,$12.00,',
  'C-1012,Lucas Rossi,lucas.rossi@example.com,(555) 010-0112,05/09/2026,Italy,Home & Garden,$450.00,"=HYPERLINK(""http://example.com"",""click"")"',
  'C-1013,Charlotte Dubois,charlotte.dubois@example.com,(555) 010-0113,2026-05-12,France,Books,$9.99,',
  'C-1014,Henry Schmidt,henry.schmidt@example.com,555-0114,2026-05-30,Germany,Electronics,"$3,120.00",VIP',
  'C-1015,Amelia Clark,amelia.clark@example.com,(555) 010-0115,06/11/2026,USA,toys,$27.50,',
  'C-1016,Benjamin Lee,,(555) 010-0116,2026-06-19,USA,Books,$18.00,',
  'C-1017,Harper Young,harper.young@example.com,(555) 010-0117,2026-06-21,usa,Home & Garden,N/A,',
  'C-1008,Ethan Walker,ethan.walker@example.com,(555) 010-0108,2026-03-20,USA,Electroncs,$799.00,',
  'C-1018,Evelyn Scott,evelyn.scott@example.com,(555) 010-0118,07/04/2026,USA,Electronics,$1100,',
  'C-1019,Alexander King,alexander.king@example.com,(555) 010-0119,2026-07-15,Canada,Toys,$64.25,',
  'C-1020,Abigail Wright,abigail.wright@example.com,(555) 010-0120,2026-07-28,USA,Books,$31.00,',
].join('\r\n') + '\r\n'

/** What the sample is meant to demonstrate, shown next to the "Try a sample file" button. */
export const SAMPLE_PROBLEMS = [
  'One row that is an exact copy of another, and one that differs only by extra spaces',
  'Extra spaces in names and in the "Email " column name',
  'Categories written several ways (Electronics, electronics, ELECTRONICS, Electroncs)',
  'Missing values, some written as N/A or NULL',
  'Dates in mixed formats, plus two that are not real dates',
  'Names in ALL CAPS and lowercase, a mistyped email, and a formula-like cell',
]
