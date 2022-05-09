
print "\t"
File.open("bos.pdx","rb") {
    |f|
    a = f.read
    count = 0
    a.each_byte { |n|
        printf(" 0x%02x,", n);
        count+=1
        if count >= 16
            puts
            print "\t"
            count = 0
        end
    }
}
