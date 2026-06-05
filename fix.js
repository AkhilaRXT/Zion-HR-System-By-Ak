import fs from 'fs';

const newCode = `  const canViewEmployee = (empId: string) => {
    if (session.email === "zioncommercialcreditampara@gmail.com") return true;
    if (viewableBranches.includes('ALL')) return true;
    const emp = (data.employees || []).find((e: any) => e.id === empId);
    if (!emp) return false;
    if (viewableBranches.length > 0) return viewableBranches.includes(emp.branch);
    if (session.isAdmin) {
      const myEmp = (data.employees || []).find((e: any) => e.id === session.empId);
      return myEmp?.branch === emp.branch;
    }
    return false;
  };`;

const oldRegex = /  const canViewEmployee = \(empId: string\) => {[\s\S]*?return emp \? viewableBranches\.includes\(emp\.branch\) : false;\n  };/g;

fs.readdirSync('src/components').forEach(file => {
  if (file.endsWith('.tsx')) {
    const path = 'src/components/' + file;
    let content = fs.readFileSync(path, 'utf8');
    if (content.match(oldRegex)) {
        content = content.replace(oldRegex, newCode);
        fs.writeFileSync(path, content);
        console.log('Updated', path);
    }
  }
});
