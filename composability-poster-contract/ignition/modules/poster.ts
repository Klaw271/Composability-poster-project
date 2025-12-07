import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("PosterModule", (m) => {
    const poster = m.contract("Poster", [
        "0x0000000000000000000000000000000000000000",
        0
    ]);
    
    const newOwner = "0xB3C1BE13202342256696191C5b2B8E142F593855";
    
    m.call(poster, "transferOwnership", [newOwner]);
    
    return { poster };
});
