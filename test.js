const userDetails = {
  name: "himanshi",
  age: "44",
  address: {
    city: "delhi",
    state: "delhi",
  },
};

const clonedUserDetails = JSON.parse(JSON.stringify(userDetails)); // DEEP CLONING

clonedUserDetails.address.city = "Noida";
clonedUserDetails.address.state = "UP";

console.log(clonedUserDetails);