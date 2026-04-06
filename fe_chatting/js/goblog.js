async function anjing(token){
    try{
        const response = await fetch('http://localhost:3000/api/blog', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        if(!response.ok){
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error:', error);
    }
}


async function coba(token){
    try{
        const response = await fetch(`http/////lovalpolonaman`,{
            headers:{
                'Authorization': `Bearer ${token}`
            }
        })

        if(!response.ok){
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        console.log(data)
        return data
    }catch(error){
        console.error('Error:', error);
    }
}