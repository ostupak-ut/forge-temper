import { verifyProtoDir } from '../server/verify/discParser'
const dir = process.argv[2]
verifyProtoDir(dir).then((v) => console.log(JSON.stringify(v && { ...v, reportExcerpt: v.reportExcerpt?.slice(0, 70) }, null, 2)))
